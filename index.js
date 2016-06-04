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

Client.findOne({}, function(err, user) {
  if (!err && user) {
    user.remove();
  }
});

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
  console.log("get response route");
  res.send('Hello world, I am a chat bot');
});

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
      else if (params[0] === "help") {
        sendTextMessage(sender, "Help\nSend: <key + \"your key\" to update or set it\nSend any message to get your droplets.");
      }
      else {
        if (!client.token) {
          sendTextMessage(sender, "Welcome back simple message : " + message);
        }
        else {
          getCardsDroplets(client.token, function(cards) {
            sendGenericMessage(sender, cards);
          });
        }
      }
    }
  });
}

const handlePostback = function(sender, postback) {
  console.log("postback check : " + postback);
  Client.findOne({clientId: sender}, function(err, client) {
    if (err || !client) return;
    const params = postback.split('-');
    console.log("params : ");
    console.log(params);
    const command = params[0];
    const idDroplet = params[1];
    console.log("command : " + command);
    console.log("id : " + idDroplet);
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
        const kernel = (droplet.kernet) ? droplet.kernel.name : "null";

        var message = "name: " + droplet.name + "\n";
        message += "memory: " + droplet.memory + "\n";
        message += "vcpus: " + droplet.vcpu + "\n";

        // const message = "name: " + droplet.name + "\nmemory: " + droplet.memory + "\nvcpus: " + droplet.vcpus + "\ndisk: " + droplet.disk + "\nlocked: " + droplet.locked + "\nstatus: " + droplet.status + "\nimage: " + imageDistribution + " " + imageName + "\nkernel: " + kernel + "\nregion: " + droplet.region.name;
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
    if (event.message && event.message.text) {
      const text = event.message.text
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

// app.post('/webhook/', function (req, res) {
//   let messaging_events = req.body.entry[0].messaging;
//   console.log("messages events");
//   console.log(messaging_events);
//   var i = 0;
//   const length = messaging_events.length;
//
//   console.log("i length : " + length);
//
//   const fn = function() {
//     if (i < length) {
//       let event = req.body.entry[0].messaging[i]
//       let sender = event.sender.id
//
//       Client.findOne({clientId: sender}, function(err, client) {
//         if (err) {
//           sendTextMessage(sender, "Welcome on digital ocean bot for Messenger.Error. 💦");
//           i++;
//         }
//         else {
//           if (!client) {
//             let newClient = new Client({
//               clientId: sender
//             });
//
//             newClient.save(function(err) {
//               i++;
//               sendTextMessage(sender, "Welcome on digital ocean bot for Messenger. You didn't registered any API key. Please send me your key. 💦");
//             });
//           }
//           else {
//             if (event.message && event.message.text) {
//               let text = event.message.text;
//               sendTextMessage(sender,  "get message text  ; " + text);
//             }
//             else {
//               console.log("event not a message");
//             }
//             i++;
//           }
//         }
//       });
//     }
//     else {
//       console.log("send response status");
//       res.sendStatus(200);
//     }
//   };
//   fn();
// });

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
