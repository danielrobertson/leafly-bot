require("dotenv").config();
const request = require("request");

// Send messages to the Messenger Platform
function callSendAPI(sender_psid, response) {
  let request_body = {
    recipient: {
      id: sender_psid,
    },
    message: response,
  };

  request(
    {
      uri: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
      method: "POST",
      json: request_body,
    },
    (err, res, body) => {
      if (!err) {
        console.log("message sent!");
      } else {
        console.error("Unable to send message:" + err);
      }
    }
  );
}

// Setting up settings and features about a conversation such as the greeting and persistent menu
function callProfileAPI(payload) {
  request(
    {
      uri: "https://graph.facebook.com/v8.0/me/messenger_profile",
      qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
      method: "POST",
      json: payload,
    },
    (err, res, body) => {
      if (!err) {
        console.log("profile payload sent!");
      } else {
        console.error("Unable to send profile payload:" + err);
      }
    }
  );
}

module.exports = {
  callProfileAPI,
  callSendAPI,
};
