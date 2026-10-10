"use strict";

const MinecraftStatusServer = require("./MinecraftStatusServer");

const server = new MinecraftStatusServer({
    host: "0.0.0.0",
    port: 25565,

    versionName: "FakeMCServer",
    motd: "§aWelcome to FakeMCServer!",

    maxPlayers: 20,
    players: ["ExamplePlayer"],

    iconPath: "./server-icon.png",

    kickMessage: "You cannot join this server!",
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
