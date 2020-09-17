const electron = require('electron');
const { app, BrowserWindow, ipcMain, clipboard } = electron;
const Discord = require('discord.js');
const discordClient = new Discord.Client();


let tokenWindow, mainWindow;
let guilds, guildChannels;

let actualChannel = null;
/**
 * Loads messages from a map to the ui
 */
function messagestowindow(value) {
    var url = 0;
    value.attachments.forEach(attachment => {
        url = attachment.url;
    });
    mainWindow.webContents.send('newmessage', value, url);
}

/**
 * Start of windows management
 */

function createTokenWindow() {
    tokenWindow = new BrowserWindow({
        width: 600,
        height: 300,
        center: true,
        title: "Please enter the bot token",
        resizable: false,
        minimizable: false,
        maximizable: false,
        autoHideMenuBar: true,
    });
    tokenWindow.loadFile('front/token.html');
    tokenWindow.on('closed', () => {
        tokenWindow = null;
    });
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 750,
        title: "Bot management",
        resizable: true,
        minimizable: true,
        maximizable: true,
        autoHideMenuBar: true,
        enableLargerThanScreen: true,
    });
    mainWindow.setMinimumSize(1000, 750);
    mainWindow.loadFile('front/main.html');
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('window-all-closed', () => {
    discordClient.destroy();
    app.quit();
});
app.on('ready', createTokenWindow);
/**
 * End of Windows Management
 * Start of Discord Bot Management
 */
discordClient.on('ready', () => {
    createMainWindow();
    discordClient.user.setActivity('git.io/JePgt');
    tokenWindow.close();
});

discordClient.on('error', (err) => {
    electron.dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'An error occurred !',
        message: `An error occurred with the bot connexion.\n(Error: ${err.message})\n`,
        buttons: ['Disconnect', 'Continue'],
    }, (response => {
        if (response === 0) {
            createTokenWindow();
            mainWindow.close();
        }
    }));
});

discordClient.on('message', (message) => {
    if (message.channel === actualChannel) {
        messagestowindow(message);
    }
});

discordClient.on('messageUpdate', (oldMessage, newMessage) => {
    if (newMessage.channel === actualChannel) {
        mainWindow.webContents.send('updatedMessage', oldMessage, newMessage);
    }
});

discordClient.on('messageDelete', (message) => {
    if (message.channel === actualChannel) {
        mainWindow.webContents.send('deletedMessage', message);
    }
});

/**
 * End of Discord Bot Management
 * Start of IPC Management
 */

// We manage now IPC :
ipcMain.on('tokenSent', (event, token) => {
    const loginPromise = discordClient.login(token);
    loginPromise.then(null, (err) => {
        electron.dialog.showMessageBox(tokenWindow, {
            type: 'error',
            title: 'Bot connection failed',
            message: `The connection to the bot failed.\n(Error: ${err.message})`,
        }, () => {
            tokenWindow.webContents.send('tokenFailed');
        });
    });
});

ipcMain.on('loaded', (event) => {
    guilds = discordClient.guilds.cache.array()
    event.sender.send('init', guilds);
});

ipcMain.on('changesrv', (event, id) => {
    actualChannel = null;
    discordClient.guilds.fetch(id)
        .then(guild => guildChannels = guild.channels.cache.array())
        .then(guild => event.sender.send('srvinfo', guildChannels, guild));
});

ipcMain.on('changechannel', (event, id) => {
    discordClient.channels.fetch(id).then( actualChannel => {
    actualChannel.messages.fetch({ limit: 100 })
        .then(messages => messages.first(100).reverse().forEach(console.log))
        .catch(console.error);
    event.sender.send('channelok');
})
});

ipcMain.on('post', (event, message) => {
    const sendPromise = actualChannel.send(message);

    sendPromise.then(null, (err) => {
        electron.dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'The message cannot be sent',
            message: `The message cannot be sent.\n(Error: ${err.message})`,
        });
    });
});

ipcMain.on('generateinvitation', (event, channelId) => {
    let channel = discordClient.channels.get(channelId);

    channel.createInvite({ maxAge: 0 }).then((invite) => {
        electron.dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'The invitation was created',
            message: `The invitation was created with following code:\n${invite.code}`,
            buttons: ['Ok', 'Copy']
        }, (response) => {
            if (response === 1) {
                clipboard.writeText(invite.code);
            }
        });
    }, (err) => {
        electron.dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Invitation cannot be created',
            message: `The invitation creation failed.\n(Error: ${err.message}`,
        }, () => {});
    });
});
ipcMain.on('usertagged', (event, userID) => {
    discordClient.fetchUser(userID).then(function(value) {
        if (discordClient.user.id == userID) event.returnValue = `<span class="mention mentioned" role="button">@` + value.username;
        event.returnValue = `<span class="mention" role="button">@` + value.username;
    });
});
/**
 * End of IPC Management
 */
