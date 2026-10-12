
"use strict";

const MinecraftStatusServer = require("./MinecraftStatusServer");

const server = new MinecraftStatusServer({
    host: "0.0.0.0",
    port: 25565,

    versionName: "Maintenance Mode",
    versionIncompatible: true,

    motd: "§cServer maintenance\n§7Please check back soon!",
    maxPlayers: 20,
    players: ["Maintenance"],

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
