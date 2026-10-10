
const net = require("node:net");
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

class MinecraftStatusServer {
    constructor(options = {}) {
        this.host = options.host ?? "0.0.0.0";
        this.port = options.port ?? 25565;

        // Match the original Main.java configuration.
        this.versionName = options.versionName ?? "";
        this.motd = options.motd ?? "";
        this.maxPlayers = options.maxPlayers ?? null;
        this.players = options.players ?? [];
        this.iconPath = options.iconPath ?? "./server-icon.png";

        // Read kickmessage.txt if no explicit message was supplied.
        this.kickMessage =
            options.kickMessage ??
            this.readKickMessage(options.kickMessagePath ?? "./kickmessage.txt");

        this.defaultKickMessage =
            "Server is currently stopped, sorry.";

        this.server = null;
        this.sockets = new Set();
    }

    readKickMessage(file) {
        try {
            return fs.readFileSync(file, "utf8").trim();
        } catch {
            return "";
        }
    }

    start() {
        if (this.server) {
            throw new Error("Server is already running");
        }

        this.server = net.createServer((socket) => {
            this.handleConnection(socket);
        });

        this.server.on("error", (error) => {
            console.error("Server error:", error);
        });

        this.server.listen({
            host: this.host,
            port: this.port,
            backlog: 5
        }, () => {
            console.log(
                `FakeMCServer listening on ${this.host}:${this.port}`
            );
        });
    }

    stop() {
        if (!this.server) return;

        this.server.close();
        this.server = null;

        for (const socket of this.sockets) {
            socket.destroy();
        }

        this.sockets.clear();
    }

    handleConnection(socket) {
        this.sockets.add(socket);
        socket.setTimeout(3000);

        socket.on("timeout", () => socket.destroy());
        socket.on("error", () => {});
        socket.on("close", () => this.sockets.delete(socket));

        let buffer = Buffer.alloc(0);
        let state = "HANDSHAKE";
        let protocol = 0;
        let loginDisconnectSent = false;

        socket.on("data", (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);

            try {
                while (!socket.destroyed && buffer.length > 0) {
                    const packet = this.readPacket(buffer);

                    // Incomplete TCP packet: wait for more bytes.
                    if (!packet) break;

                    buffer = packet.remaining;

                    if (state === "HANDSHAKE") {
                        if (packet.id !== 0) {
                            throw new Error("Expected handshake packet");
                        }

                        const handshake = this.parseHandshake(packet.data);
                        protocol = handshake.protocol;

                        if (handshake.nextState === 1) {
                            state = "STATUS";
                        } else if (handshake.nextState === 2) {
                            state = "LOGIN";
                        } else {
                            socket.destroy();
                            return;
                        }
                    } else if (state === "STATUS") {
                        if (packet.id === 0x00) {
                            this.sendStatus(socket, protocol);
                        } else if (packet.id === 0x01) {
                            this.sendPong(socket, packet.data);
                            socket.end();
                            return;
                        } else {
                            socket.destroy();
                            return;
                        }
                    } else if (state === "LOGIN") {
                        // Login Start packet ID is 0x00.
                        if (packet.id !== 0x00 || loginDisconnectSent) {
                            socket.destroy();
                            return;
                        }

                        loginDisconnectSent = true;
                        const message =
                            this.kickMessage || this.defaultKickMessage;

                        this.sendLoginDisconnect(socket, message);

                        console.log(
                            `kick: ${socket.remoteAddress} - ${message}`
                        );

                        // Let the queued disconnect packet flush first.
                        socket.end();
                        return;
                    }
                }
            } catch (error) {
                console.warn("Invalid client packet:", error.message);
                socket.destroy();
            }
        });
    }

    parseHandshake(data) {
        let offset = 0;

        const protocol = readVarInt(data, offset);
        if (!protocol) throw new Error("Incomplete protocol version");
        offset += protocol.bytes;

        const address = readString(data, offset);
        if (!address) throw new Error("Incomplete server address");
        offset += address.bytes;

        if (offset + 2 > data.length) {
            throw new Error("Incomplete server port");
        }
        offset += 2;

        const nextState = readVarInt(data, offset);
        if (!nextState) throw new Error("Missing handshake state");

        return {
            protocol: protocol.value,
            address: address.value,
            nextState: nextState.value
        };
    }

    sendStatus(socket, protocol) {
        const players = Array.isArray(this.players)
            ? this.players
            : [];

        const response = {
            version: {
                name: this.versionName,
                protocol
            },
            players: {
                max: this.maxPlayers ?? 0,
                online: this.maxPlayers == null ? 0 : players.length,
                sample: this.maxPlayers == null
                    ? []
                    : players.slice(0, 10).map((name) => ({
                        name,
                        // The original implementation generated UUIDs
                        // dynamically for status samples.
                        id: crypto.randomUUID()
                    }))
            },
            description: {
                text: this.motd || "\u0000"
            }
        };

        const favicon = this.getFavicon();
        if (favicon) response.favicon = favicon;

        const json = JSON.stringify(response);
        this.sendPacket(socket, 0x00, writeString(json));
    }

    getFavicon() {
        if (!this.iconPath) return null;

        try {
            const icon = fs.readFileSync(path.resolve(this.iconPath));
            const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

            if (!icon.subarray(0, 8).equals(signature)) {
                console.warn("Server icon is not a PNG file");
                return null;
            }

            return `data:image/png;base64,${icon.toString("base64")}`;
        } catch {
            // Favicon is optional; status still works without it.
            return null;
        }
    }

    sendPong(socket, data) {
        // Ping packet payload must be exactly eight bytes.
        if (data.length !== 8) {
            throw new Error("Invalid ping payload");
        }

        // Echo the client's 64-bit payload unchanged.
        this.sendPacket(socket, 0x01, data);
        console.log(`pong: ${data.readBigInt64BE()}`);
    }

    sendLoginDisconnect(socket, message) {
        // Login Disconnect packet: ID 0x00 + JSON chat component.
        const component = JSON.stringify({ text: message });
        this.sendPacket(socket, 0x00, writeString(component));
    }

    sendPacket(socket, packetId, payload = Buffer.alloc(0)) {
        const body = Buffer.concat([
            writeVarInt(packetId),
            payload
        ]);

        socket.write(Buffer.concat([
            writeVarInt(body.length),
            body
        ]));
    }

    // Update these when you change the configured values at runtime.
    setKickMessage(message) {
        this.kickMessage = String(message);
    }

    setMotd(motd) {
        this.motd = String(motd);
    }

    setPlayers(players) {
        this.players = [...players];
    }
}

function readVarInt(buffer, offset = 0) {
    let value = 0;
    let shift = 0;

    for (let i = 0; i < 5; i++) {
        if (offset + i >= buffer.length) return null;

        const byte = buffer[offset + i];
        value |= (byte & 0x7f) << shift;

        if ((byte & 0x80) === 0) {
            return { value, bytes: i + 1 };
        }

        shift += 7;
    }

    throw new Error("VarInt is too long");
}

function writeVarInt(value) {
    value >>>= 0;
    const bytes = [];

    do {
        let byte = value & 0x7f;
        value >>>= 7;

        if (value !== 0) byte |= 0x80;
        bytes.push(byte);
    } while (value !== 0);

    return Buffer.from(bytes);
}

function readString(buffer, offset = 0) {
    const length = readVarInt(buffer, offset);
    if (!length) return null;

    const start = offset + length.bytes;
    const end = start + length.value;

    if (end > buffer.length) return null;

    return {
        value: buffer.toString("utf8", start, end),
        bytes: length.bytes + length.value
    };
}

function writeString(value) {
    const data = Buffer.from(value, "utf8");

    return Buffer.concat([
        writeVarInt(data.length),
        data
    ]);
}

function readPacket(buffer) {
    const length = readVarInt(buffer);
    if (!length) return null;

    // Prevent clients from claiming excessively large packet sizes.
    if (length.value < 1 || length.value > 2 * 1024 * 1024) {
        throw new Error("Invalid packet length");
    }

    const start = length.bytes;
    const end = start + length.value;

    if (buffer.length < end) return null;

    const id = readVarInt(buffer, start);
    if (!id) throw new Error("Missing packet ID");

    const dataStart = start + id.bytes;

    return {
        id: id.value,
        data: buffer.subarray(dataStart, end),
        remaining: buffer.subarray(end)
    };
}

module.exports = MinecraftStatusServer;
