
const MinecraftStatusServer = require("./MinecraftStatusServer");

const server = new MinecraftStatusServer({
    host: "0.0.0.0",
    port: 25565,

    // Shown in the multiplayer server list
    versionName: "FakeMCServer",
    motd: "§aWelcome to FakeMCServer!",

    // Match the original Main.java behavior:
    maxPlayers: 20,
    players: ["ExamplePlayer"],

    iconPath: "./server-icon.png",
    kickMessagePath: "./kickmessage.txt"
});

server.start();
