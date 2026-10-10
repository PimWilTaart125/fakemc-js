"use strict";

const net = require("node:net");
const fs = require("node:fs");
const crypto = require("node:crypto");

class MinecraftStatusServer {
    constructor(options = {}) {
        this.host = options.host ?? "0.0.0.0";
        this.port = options.port ?? 25565;

        this.versionName = options.versionName ?? "Offline";
        this.motd = options.motd ?? "&6&o[!] Server Maintenance [!]";
        this.maxPlayers = options.maxPlayers ?? 0;
        this.players = options.players ?? [];

        this.iconPath = options.iconPath ?? "./server-icon.png";
        this.kickMessage = options.kickMessage ?? "You cannot join this server.";
        this.kickMessagePath = options.kickMessagePath ?? null;

        this.server = null;
        this.sockets = new Set();
    }

    start() {
        if (this.server) {
            console.log("Server is already running.");
            return;
        }

        this.server = net.createServer((socket) => {
            this.handleConnection(socket);
        });

        this.server.on("error", (err) => {
            console.error("TCP server error:", err.message);
        });

        this.server.listen(this.port, this.host, () => {
            console.log(
                `FakeMCServer listening on ${this.host}:${this.port}`
            );
        });
    }

    stop() {
        for (const socket of this.sockets) {
            socket.destroy();
        }

        this.sockets.clear();

        if (!this.server) return;

        const server = this.server;
        this.server = null;

        server.close((err) => {
            if (err) {
                console.error("Error closing server:", err.message);
            } else {
                console.log("FakeMCServer stopped.");
            }
        });
    }

    handleConnection(socket) {
        socket.setTimeout(10000);
        socket.setNoDelay(true);

        this.sockets.add(socket);

        const client = {
            socket,
            buffer: Buffer.alloc(0),
            state: "handshake",
            protocol: 0,
            closed: false,
        };

        socket.on("data", (chunk) => {
            try {
                this.processData(client, chunk);
            } catch (err) {
                console.error("Invalid client packet:", err.message);
                socket.destroy();
            }
        });

        socket.on("timeout", () => socket.destroy());

        socket.on("error", () => {
        });

        socket.on("close", () => {
            client.closed = true;
            this.sockets.delete(socket);
        });
    }

    processData(client, chunk) {
        client.buffer = Buffer.concat([client.buffer, chunk]);

        while (client.buffer.length > 0 && !client.closed) {
            const result = readPacket(client.buffer);

            if (!result) {
                return; 
            }

            client.buffer = result.remaining;
            this.handlePacket(client, result.data);
        }
    }

    handlePacket(client, packet) {
        const cursor = { offset: 0 };
        const packetId = readVarInt(packet, cursor);

        if (packetId === null) {
            throw new Error("Missing packet ID");
        }

        if (client.state === "handshake") {
            if (packetId !== 0) {
                throw new Error("Expected handshake packet");
            }

            client.protocol = readVarInt(packet, cursor);

            if (client.protocol === null) {
                throw new Error("Missing protocol version");
            }

            readString(packet, cursor);

            if (cursor.offset + 2 > packet.length) {
                throw new Error("Incomplete handshake port");
            }
            cursor.offset += 2;

            const nextState = readVarInt(packet, cursor);

            if (nextState === 1) {
                client.state = "status";
                console.log(
                    `Status request (protocol ${client.protocol})`
                );
            } else if (nextState === 2) {
                client.state = "login";
            } else {
                client.socket.destroy();
            }

            return;
        }

        if (client.state === "status") {
            if (packetId === 0) {
                this.sendStatus(client);
            } else if (packetId === 1) {
                this.sendPong(client, packet, cursor);
            }

            return;
        }

        if (client.state === "login") {
            if (packetId === 0) {
                this.sendLoginDisconnect(client);
            }
        }
    }

    sendStatus(client) {
        const names = Array.isArray(this.players)
            ? this.players.slice(0, 10)
            : [];

        const online = Array.isArray(this.players)
            ? this.players.length
            : 0;

        const status = {
            version: {
                name: this.versionName,
                protocol: client.protocol,
            },
            players: {
                max: this.maxPlayers,
                online,
                sample: names.map((name) => ({
                    name: String(name),
                    id: crypto.randomUUID(),
                })),
            },
            description: {
                text: this.motd,
            },
        };

        const favicon = this.getFavicon();

        if (favicon) {
            status.favicon = favicon;
        }

        this.sendPacket(client.socket, 0, writeString(JSON.stringify(status)));
    }

    sendPong(client, packet, cursor) {
        if (cursor.offset + 8 > packet.length) {
            throw new Error("Incomplete ping packet");
        }

        const payload = packet.subarray(cursor.offset, cursor.offset + 8);

        this.sendPacket(client.socket, 1, payload);
    }

    sendLoginDisconnect(client) {
        const message = this.loadKickMessage();

        const component = JSON.stringify({
            text: message,
        });

        this.sendPacket(client.socket, 0, writeString(component));
        client.socket.end();
    }

    loadKickMessage() {
        if (this.kickMessagePath) {
            try {
                return fs.readFileSync(this.kickMessagePath, "utf8").trimEnd();
            } catch (err) {
                console.error("Could not read kick message:", err.message);
            }
        }

        return this.kickMessage;
    }

    getFavicon() {
        if (!this.iconPath) return null;

        try {
            if (this.iconPath.startsWith("data:image/png;base64,")) {
                return this.iconPath;
            }

            const image = fs.readFileSync(this.iconPath);

            const pngSignature = Buffer.from([
                0x89, 0x50, 0x4e, 0x47,
                0x0d, 0x0a, 0x1a, 0x0a,
            ]);

            if (
                image.length < 8 ||
                !image.subarray(0, 8).equals(pngSignature)
            ) {
                console.warn("Server icon is not a valid PNG.");
                return null;
            }

            return `data:image/png;base64,${image.toString("base64")}`;
        } catch {
            return null;
        }
    }

    sendPacket(socket, packetId, payload = Buffer.alloc(0)) {
        if (socket.destroyed) return;

        const body = Buffer.concat([
            writeVarInt(packetId),
            payload,
        ]);

        const frame = Buffer.concat([
            writeVarInt(body.length),
            body,
        ]);

        socket.write(frame);
    }

    updateConfig(options = {}) {
        const allowed = [
            "host",
            "port",
            "versionName",
            "motd",
            "maxPlayers",
            "players",
            "iconPath",
            "kickMessage",
            "kickMessagePath",
        ];

        for (const key of allowed) {
            if (Object.prototype.hasOwnProperty.call(options, key)) {
                this[key] = options[key];
            }
        }
    }

    getStatus() {
        return {
            running: this.server?.listening ?? false,
            host: this.host,
            port: this.port,
            connections: this.sockets.size,
        };
    }
}


function readPacket(buffer) {
    const lengthInfo = tryReadVarInt(buffer, 0);

    if (!lengthInfo) return null;

    const packetLength = lengthInfo.value;
    const headerLength = lengthInfo.bytes;

    if (packetLength < 0 || packetLength > 2 * 1024 * 1024) {
        throw new Error("Invalid packet length");
    }

    if (buffer.length < headerLength + packetLength) {
        return null;
    }

    return {
        data: buffer.subarray(
            headerLength,
            headerLength + packetLength
        ),
        remaining: buffer.subarray(headerLength + packetLength),
    };
}

function tryReadVarInt(buffer, offset) {
    let value = 0;
    let position = 0;

    while (position < 5) {
        const index = offset + position;

        if (index >= buffer.length) {
            return null;
        }

        const byte = buffer[index];

        value |= (byte & 0x7f) << (position * 7);
        position++;

        if ((byte & 0x80) === 0) {
            return {
                value: value >>> 0,
                bytes: position,
            };
        }
    }

    throw new Error("VarInt is too large");
}

function readVarInt(buffer, cursor) {
    const result = tryReadVarInt(buffer, cursor.offset);

    if (!result) return null;

    cursor.offset += result.bytes;

    return result.value | 0;
}

function writeVarInt(value) {
    const bytes = [];
    value |= 0;

    while ((value & ~0x7f) !== 0) {
        bytes.push((value & 0x7f) | 0x80);
        value >>>= 7;
    }

    bytes.push(value);
    return Buffer.from(bytes);
}

function readString(buffer, cursor) {
    const length = readVarInt(buffer, cursor);

    if (length === null || length < 0) {
        throw new Error("Invalid string length");
    }

    if (cursor.offset + length > buffer.length) {
        throw new Error("Incomplete string");
    }

    const value = buffer
        .subarray(cursor.offset, cursor.offset + length)
        .toString("utf8");

    cursor.offset += length;
    return value;
}

function writeString(value) {
    const stringBuffer = Buffer.from(value, "utf8");

    return Buffer.concat([
        writeVarInt(stringBuffer.length),
        stringBuffer,
    ]);
}

module.exports = MinecraftStatusServer;
