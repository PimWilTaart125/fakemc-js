"use strict";

const MinecraftStatusServer = require("./MinecraftStatusServer");

const server = new MinecraftStatusServer({
    host: "0.0.0.0",
    port: 25565,

    versionName: "Offline",
    motd: "§6» §e§lSERVER MAINTENANCE §6«",

    maxPlayers: 0,
    players: ["Nerd"],

    iconPath: "./server-icon.png",

    kickMessage: "Get tf out bro.",
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
