'use strict'

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

const getCardsDroplets = function(completion) {
  api.listDroplets(function(error, droplets) {
    console.log("droplets : ");
    let cardsDroplets = droplets.map(function(droplet) {
      var buttonPower;

      if (droplet.status == 'active') {
        buttonPower =           {
          "type": "postback",
          "title": "Power OFF 🌑",
          "payload": "power-off-" + droplet.id,
        }
      }
      else {
        buttonPower = {
          "type": "postback",
          "title": "Power ON 🌕",
          "payload": "power-on-" + droplet.id,
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
            "payload": "power-off-" + droplet.id,
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
  console.log("get response route");
  res.send('Hello world, I am a chat bot');
});

app.post('/webhook/', function (req, res) {
  let messaging_events = req.body.entry[0].messaging;
  console.log("messages events");
  console.log(messaging_events);

  var i = 0;
  const length = messaging_events.length;
  const fn = function() {

    if (i < length) {
      let event = req.body.entry[0].messaging[i]
      let sender = event.sender.id

      Client.findOne({clientId: sender}, function(err, client) {
        console.log("find client : ");
        console.log(client);
        if (err) {
          sendTextMessage(sender, "Welcome on digital ocean bot for Messenger.Error. 💦");
          i++;
        }
        else {
          if (!client) {
            let newClient = new Client({
              clientId: sender
            });

            newClient.save(function(err) {
              i++;
            });
            sendTextMessage(sender, "Welcome on digital ocean bot for Messenger. You didn't registered any API key. Please send me your key. 💦");
          }
          else {
            console.log("event debug");
            console.log(event.message);
            console.log(event.message.text);
            if (event.message && event.message.text) {
              let text = event.message.text;
              console.log("get text event");
              console.log(text);
              if (text === 'Generic') {
                sendTextMessage(sender, "Received API KEY : " + text + " 💦");
              }
              else {
                console.log("not generic text");
              }
            }
            else {
              console.log("event not a message");r
            }
            i++;
          }
        }
      });
    }
    else {
      console.log("send response status");
      res.sendStatus(200);
    }
  };
  fn();

  // for (let i = 0; i < messaging_events.length; i++) {
  //   let event = req.body.entry[0].messaging[i]
  //   console.log("received new event");
  //   console.log(event);
  //
  //   let sender = event.sender.id
  //   Client.findOne({clientId: sender}, function(err, client) {
  //     console.log("find client : ");
  //     console.log(client);
  //     if (err) {
  //       sendTextMessage(sender, "Welcome on digital ocean bot for Messenger.Error. 💦");
  //     }
  //     else {
  //       if (!client) {
  //         sendTextMessage(sender, "Welcome on digital ocean bot for Messenger. You didn't registered any API key. Please send me your key. 💦");
  //       }
  //       else {
  //         sendTextMessage(sender, "Welcome on digital ocean bot for Messenger. You didn't registered any API key. Please send me your key. 💦");
  //       }
  //     }
  //     if (i == messaging_events.length - 1) {
  //       res.sendStatus(200);
  //     }
  //   });

  // if (event.message && event.message.text) {
  //   let text = event.message.text
  //   if (text === 'Generic') {
  //     sendGenericMessage(sender)
  //     continue
  //   }
  //
  //   getCardsDroplets(function(cards) {
  //     sendGenericMessage(sender, cards);
  //   });
  //
  //   // sendGenericMessage(sender);
  //   //sendTextMessage(sender, "Text received, echo: " + text.substring(0, 200))
  // }
  // if (event.postback) {
  //   console.log("event post back : ");
  //   console.log(event.postback);
  //   console.log("EVENT DEBUG");
  //   console.log(event);
  //   let text = JSON.stringify(event.postback)
  //
  //   sendTextMessage(sender, "Postback received: "+text.substring(0, 200), config.token);
  //   continue
  // }
  //}
  // res.sendStatus(200)
});

function sendTextMessage(sender, text) {
  let messageData = { text:text }
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
  let messageData = {
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
