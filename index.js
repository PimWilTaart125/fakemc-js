
"use strict";

const MinecraftStatusServer = require("./MinecraftStatusServer");

const server = new MinecraftStatusServer({
    host: "0.0.0.0",
    port: 25565,

    versionName: "Offline",
    versionIncompatible: true,

    motd: "§cServer maintenance\n§7Please check back soon!",
    maxPlayers: 20,
    players: [
    "§8§m━━━━━━━━━━━━━━━━━━━━",
    "§c§l⚠ MAINTENANCE ⚠",
    "§7The server is currently",
    "§7taking a little nap...",
    "§8§m━━━━━━━━━━━━━━━━━━━━",
    "§aWe'll be back soon!",
    "§8§m━━━━━━━━━━━━━━━━━━━━",
    "§bThanks for your patience!",
    "§8§m━━━━━━━━━━━━━━━━━━━━"
],

    iconPath: "./server-icon.png",
    kickMessage: "The server is currently under maintenance.",
    kickMessagePath: "./kickmessage.txt",
});

server.start();

process.on("SIGINT", () => {
    server.stop();
    setTimeout(() => process.exit(0), 200);
});

process.on("SIGTERM", () => {
    server.stop();
    setTimeout(() => process.exit(0), 200);
});
