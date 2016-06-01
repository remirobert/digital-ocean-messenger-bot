'use strict'

const fs = require('fs');
const http = require('http');
const https = require('https');
const privateKey  = fs.readFileSync('hacksparrow-key.pem', 'utf8');
const certificate = fs.readFileSync('hacksparrow-cert.pem', 'utf8');
const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')

const credentials = {key: privateKey, cert: certificate};
const app = express()

// Import a module
var DigitalOceanApi = require('digital-ocean-api');

app.use('/static', express.static('ressources'));

var api = new DigitalOceanApi({
  token: 'ebd10ba1ea05d984d70d57c9b4e2d685a7f25cbd3926fa9300ba4e6817e3bd78'
});

api.getDroplet('9319125', function(err, droplet) {
  console.log("detail droplet : ");
  console.log(droplet);
  console.log(err);
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

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
  res.send('Hello world, I am a chat bot')
})

// for Facebook verification

app.post('/webhook/', function (req, res) {
  let messaging_events = req.body.entry[0].messaging
  for (let i = 0; i < messaging_events.length; i++) {
    let event = req.body.entry[0].messaging[i]
    let sender = event.sender.id
    if (event.message && event.message.text) {
      let text = event.message.text
      if (text === 'Generic') {
        sendGenericMessage(sender)
        continue
      }

      getCardsDroplets(function(cards) {
        sendGenericMessage(sender, cards);
      });

      // sendGenericMessage(sender);
      //sendTextMessage(sender, "Text received, echo: " + text.substring(0, 200))
    }
    if (event.postback) {
      console.log("event post back : ");
      console.log(event.postback);
      console.log("EVENT DEBUG");
      console.log(event);
      let text = JSON.stringify(event.postback)

      sendTextMessage(sender, "Postback received: "+text.substring(0, 200), token)
      continue
    }
  }
  res.sendStatus(200)
})

const token = "EAAN8kzgEXZA4BAAwvKQCZBGz4RBJXj0TJWWXcZAYn5FoRRJZCATyVV8xwr7UAXNOHOJZCZADoQabWPO2qFAqdzbcZAblwN9mGx1OglgiGfFZCigcGaLCQjAyES0VVjWUEibudLZCfILZCEjLOd811Jld5uBjA66gIIUuWYU02Kn5sktQZDZD";

function sendTextMessage(sender, text) {
  let messageData = { text:text }
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token:token},
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
    qs: {access_token:token},
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
  if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
    res.send(req.query['hub.challenge'])
  }
  res.send('Error, wrong token')
})

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

httpServer.listen(8080);
httpsServer.listen(8443);


// // Spin up the server
// app.listen(app.get('port'), function() {
//   console.log('running on port', app.get('port'))
// })
