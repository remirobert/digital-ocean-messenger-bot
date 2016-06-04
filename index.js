const fs = require('fs');
const http = require('http');
const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const app = express();
const DigitalOceanApi = require('digital-ocean-api');
const mongoose = require('mongoose');
const config = require('config.json')('./auth.json');
mongoose.connect('mongodb://localhost/digital-ocean-bot');

app.use('/static', express.static('ressources'));

const Client = mongoose.model('Client', {
  clientId: { type: String, required: true },
  token: { type: String, required: false }
});

const getUserInfoMessage = function(token, completion) {
  const api = new DigitalOceanApi({
    token: token
  });
  api.getUserInfo(function(err, user) {
    if (!user) {
      completion(null);
      return;
    }
    var message = "droplet_limit: " + user.droplet_limit + "\n";
    message += "email: " + user.email + "\n";
    message += "uuid: " + user.uuid + "\n";
    message += "email_verified: " + user.email_verified + "\n";
    message += "status: " + user.status + "\n";
    message += "status_message: " + user.status_message;
    completion(message);
  });
}

const getCardsDroplets = function(token, completion) {
  const api = new DigitalOceanApi({
    token: token
  });
  api.listDroplets(function(error, droplets) {
    console.log("droplets : ");
    console.log(droplets);
    if (!droplets) {
      completion(null);
      return;
    }
    const cardsDroplets = droplets.map(function(droplet) {
      var buttonPower;

      if (droplet.status == 'active') {
        buttonPower =           {
          "type": "postback",
          "title": "Power OFF 🌑",
          "payload": "poweroff-" + droplet.id,
        }
      }
      else {
        buttonPower = {
          "type": "postback",
          "title": "Power ON 🌕",
          "payload": "poweron-" + droplet.id,
        }
      }
      return {
        "title": droplet.name,
        "subtitle": droplet.image.distribution + " " + droplet.image.name + "\n" + droplet.status,
        "buttons": [
          buttonPower,
          {
            "type": "postback",
            "title": "Reboot",
            "payload": "reboot-" + droplet.id,
          },
          {
            "type": "postback",
            "title": "informations",
            "payload": "informations-" + droplet.id,
          },
        ]
      }
    });
    completion(cardsDroplets);
  });
}

app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.get('/', function (req, res) {
  res.send('Hello world, I am a chat bot');
});

const handleCommandRequest = function(sender, client, command, message) {
  if (command === "help") {
    var messageHelp = "🆘\n";
    messageHelp += "➖Set your API key ➡️ key + <your key>\n";
    messageHelp += "➖Get account informations ➡️ user\n";
    messageHelp += "➖Get list droplets ➡️ <tap whatever you want>";
    sendTextMessage(sender, messageHelp);
    return ;
  }
  if (!client.token) {
    sendTextMessage(sender, "You didn't set any API Key yet. Use the command 'key' + your key");
    return;
  }
  if (command === 'user') {
    getUserInfoMessage(client.token, function(userInfo) {
      if (userInfo) {
        sendTextMessage(sender, userInfo);
      }
    });
  }
  else {
    getCardsDroplets(client.token, function(cards) {
      if (cards) {
        sendGenericMessage(sender, cards);
      }
    });
  }
}

const handleRequest = function(sender, message) {
  Client.findOne({clientId: sender}, function(err, client) {
    if (err) return;
    if (!client) {
      const client = new Client({
        clientId: sender
      });
      client.save(function(err) {
        sendTextMessage(sender, "Welcome on board");
      });
    }
    else {
      const params = message.split(' ');
      if (params[0] === 'key') {
        var key = null;
        if (params.length > 1) {
          key = params[1];
        }
        if (!key || key.length < 10)  {
          sendTextMessage(sender, "Oups, I think you didn't send me a good key");
        }
        else {
          client.token = key;
          client.save(function(err) {
            if (!err) {
              sendTextMessage(sender, "Your key is successful registered");
            }
          });
        }
      }
      else {
        handleCommandRequest(sender, client, params[0], message);
      }
    }
  });
}

const handlePostback = function(sender, postback) {
  Client.findOne({clientId: sender}, function(err, client) {
    if (err || !client) return;
    const params = postback.split('-');
    const command = params[0];
    const idDroplet = params[1];
    const api = new DigitalOceanApi({
      token: client.token
    });
    if (command === 'poweron') {
      api.powerOnDroplet(idDroplet, function(err) {

      });
    }
    else if (command === 'poweroff') {
      api.powerOffDroplet(idDroplet, function(err) {

      });
    }
    else if (command === 'reboot') {
      api.rebootDroplet(idDroplet, function(err) {

      });
    }
    else if (command === 'informations') {
      api.getDroplet(idDroplet, function(err, droplet) {
        console.log("droplet : ");
        console.log(droplet);

        const imageName = (droplet.image) ? droplet.image.name : "null";
        const imageDistribution = (droplet.image) ? droplet.image.distribution : "null";
        const kernel = (droplet.kernel) ? droplet.kernel.name : "null";
        const region = (droplet.region) ? droplet.region.name : "null";

        var message = "name: " + droplet.name + "\n";
        message += "memory: " + droplet.memory + "\n";
        message += "vcpus: " + droplet.vcpus + "\n";
        message += "disk: " + droplet.disk + "\n";
        message += "locked: " + droplet.locked + "\n";
        message += "status: " + droplet.status + "\n";
        message += "image: " + imageDistribution + " " + imageName + "\n";
        message += "kernel: " + kernel + "\n";
        message += "region: " + region;
        sendTextMessage(sender, message);
      });
    }
  });
}

app.post('/webhook/', function (req, res) {
  const messaging_events = req.body.entry[0].messaging
  for (var i = 0; i < messaging_events.length; i++) {
    const event = req.body.entry[0].messaging[i]
    const sender = event.sender.id
    console.log("get event ;");
    console.log(event);
    if (event.message) {
      const text = (event.message.text) ? event.message.text : "droplets";
      handleRequest(sender, text);
      continue;
    }
    if (event.postback) {
      const postback = event.postback.payload;
      if (postback) {
        handlePostback(sender, event.postback.payload);
      }
      continue;
    }
  }
  res.sendStatus(200);
});

function sendTextMessage(sender, text) {
  const messageData = { text:text }
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token:config.facebook_token},
    method: 'POST',
    json: {
      recipient: {id:sender},
      message: messageData,
    }
  }, function(error, response, body) {
    if (error) {
      console.log('Error sending messages: ', error)
    } else if (response.body.error) {
      console.log('Error: ', response.body.error)
    }
  })
}

function sendGenericMessage(sender, cards) {
  const messageData = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": cards
      }
    }
  }
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token:config.facebook_token},
    method: 'POST',
    json: {
      recipient: {id:sender},
      message: messageData,
    }
  }, function(error, response, body) {
    if (error) {
      console.log('Error sending messages: ', error)
    } else if (response.body.error) {
      console.log('Error: ', response.body.error)
    }
  })
}

app.get('/webhook/', function (req, res) {
  if (req.query['hub.verify_token'] === config.verify_token) {
    res.send(req.query['hub.challenge'])
  }
  res.send('Error, wrong token')
})

var httpServer = http.createServer(app);
httpServer.listen(8080);
