# FakeMCServer

A lightweight, configurable fake Minecraft server status listener built with Node.js.

FakeMCServer allows you to display a custom Minecraft server-list MOTD, version text, player count, and server icon, even when you don't want players joining a normal Minecraft server. It can also send a custom kick message when players attempt to connect.

This is useful for maintenance announcements, server restarts, temporary downtime, and communicating planned return times to players.

## Features

- **Custom MOTD** — Display a configurable message in the Minecraft multiplayer server list.
- **Custom kick message** — Tell players why they cannot join.
- **Fake player count** — Configure the displayed maximum player count and sample player names.
- **Custom server icon** — Display a PNG icon in the server list.
- **Minecraft status protocol** — Respond to server-list status requests and ping packets.
- **Configurable listener** — Choose the host address and TCP port.
- **Lightweight** — Uses Node.js built-in modules without requiring external npm packages.

## Requirements

- [Node.js](https://nodejs.org/) installed on your machine.
- A TCP port available for the server to listen on.
- Optional: a PNG server icon.

## Installation

Clone the repository or download the project files, then enter the project directory:

```bash
cd fakemc-js
```

No additional npm dependencies are required for the current implementation.

## Configuration

Edit `index.js` to configure the server:

```js
const MinecraftStatusServer = require("./MinecraftStatusServer");

const server = new MinecraftStatusServer({
    host: "0.0.0.0",
    port: 25565,

    versionName: "FakeMCServer",
    motd: "§cServer maintenance\n§7Please check back soon!",

    maxPlayers: 20,
    players: ["Maintenance"],

    iconPath: "./server-icon.png",

    kickMessage: "The server is currently under maintenance.",
    kickMessagePath: "./kickmessage.txt",
});

server.start();
```

### Configuration options

| Option | Description |
|---|---|
| `host` | Network interface to listen on. |
| `port` | TCP port used by FakeMCServer. |
| `versionName` | Version text displayed in the server list. |
| `motd` | Message displayed in the server list. |
| `maxPlayers` | Maximum player count displayed. |
| `players` | Sample player names shown in the server list. |
| `iconPath` | Path to a PNG icon, or `null` to disable it. |
| `kickMessage` | Default message sent when a player attempts to join. |
| `kickMessagePath` | Optional path to a text file containing the kick message. |

If `kickMessagePath` is configured and the file can be read, its contents take precedence over `kickMessage`.

### MOTD formatting

The MOTD accepts ordinary text and Minecraft section-sign formatting codes, such as:

- `§a` — Green
- `§c` — Red
- `§e` — Yellow
- `§b` — Aqua
- `§l` — Bold
- `§r` — Reset formatting

Use `\n` to separate lines in the configuration string.

Formatting support may vary between Minecraft client versions.

### Server icon

The icon should be a valid PNG image with dimensions of **64 × 64 pixels**.

Place it in the project directory as `server-icon.png`, or update `iconPath` to point to another file.

To disable the icon:

```js
iconPath: null,
```

## Running the server

Start FakeMCServer with:

```bash
node index.js
```

If it starts successfully, you should see a message similar to:

```text
FakeMCServer listening on 0.0.0.0:25565
```

Press `Ctrl+C` to stop the process.

## Network configuration

Make sure the configured TCP port is available and permitted by your firewall.

For example, if using port `25565`, clients must be able to reach that port on the machine running FakeMCServer.

**Important:** FakeMCServer and a real Minecraft server cannot listen on the same IP address and TCP port simultaneously. If you want to use FakeMCServer during maintenance, you need to arrange how the public address switches between the real server and the status listener.

## Project structure

```text
fakemc-js/
├── index.js
├── MinecraftStatusServer.js
├── kickmessage.txt
├── server-icon.png
└── README.md
```

The icon and kick-message file are optional if the configuration does not rely on them.

## Limitations

- FakeMCServer implements basic Minecraft status, ping/pong, and login-disconnect handling.
- It is **not** a full Minecraft game server.
- Players cannot play, move around, or interact with a Minecraft world through this service.
- Protocol compatibility can vary across Minecraft versions.



## Contributing

Contributions, bug reports, and suggestions are welcome. Please include relevant error messages and your Node.js and Minecraft client versions when reporting compatibility issues.

