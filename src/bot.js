const request = require("request");
const { responseOperations, orderStatus } = require("./constants");
const emailValidator = require("email-validator");
const {
  fetchUserByPhone,
  fetchUserByEmail,
  fetchLatestReservationByUser,
  fetchRecentDeals,
} = require("./database/db");

function firstNlpTrait(nlp, name) {
  return nlp && nlp.entities && nlp.traits[name] && nlp.traits[name][0];
}

const handleMessage = async (sender_psid, received_message) => {
  console.log(received_message);
  if (received_message.text) {
    const greeting = firstNlpTrait(received_message.nlp, "wit$greetings");
    if (greeting && greeting.confidence > 0.8) {
      sendGreeting(sender_psid);
    } else if (received_message.text === "420") {
      callSendAPI(sender_psid, {
        text: "Nice 👌🏼",
      });
    } else {
      // check for quick reply tap responses
      if (
        received_message.quick_reply &&
        received_message.quick_reply.payload
      ) {
        const payload = received_message.quick_reply.payload;
        if (emailValidator.validate(payload)) {
          // email quick reply
          const user = await fetchUserByEmail(email);
          const reservation = await fetchLatestReservationByUser(user.id);
          sendOrderStatus(sender_psid, reservation);
        } else if (payload.match(/\d/g) && payload.match(/\d/g).length === 11) {
          // phone quick reply
          callSendAPI(sender_psid, {
            text: "Looking up your account...",
          });
          console.log("order updates by phone ", received_message.text);
          const user = await fetchUserByPhone(
            received_message.text.replace("+1", "")
          );
          const reservation = await fetchLatestReservationByUser(user.id);
          sendOrderStatus(sender_psid, reservation);
        } else {
          // custom payloads
          const operation = JSON.parse(payload).operation;
          switch (operation) {
            case responseOperations.LEARN:
              sendLearnResponse(sender_psid);
              break;
            case responseOperations.SHOP:
              console.log("shop");
              break;
            case responseOperations.DEALS:
              sendDealsResponse(sender_psid);
              break;
            case responseOperations.ORDER_STATUS:
              sendAccountLookupPrompt(sender_psid);
              break;
            default:
              console.error(
                "Unknown response payload ",
                received_message.quick_reply.payload
              );
          }
        }
      }

      console.log("Catch all-- ", received_message.text);
    }
  }
};

const callSendAPI = (sender_psid, response) => {
  // Construct the message body
  let request_body = {
    recipient: {
      id: sender_psid,
    },
    message: response,
  };

  // Send the HTTP request to the Messenger Platform
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
};

async function sendDealsResponse(sender_psid) {
  console.log("sendDealsResponse");

  // todo identify user's location
  const deals = await fetchRecentDeals();
  const dealCards = deals.slice(0, 3).map((deal) => {
    return {
      title: deal.title,
      image_url: deal.image_url,
      subtitle: deal.content.replace(/(\r\n|\n|\r)/gm, ""),
      buttons: [
        {
          type: "web_url",
          title: "Shop deal",
          url: `https://www.leafly.com/dispensary-info/${deal.slug}/deals`,
        },
      ],
    };
  });

  callSendAPI(sender_psid, {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: [
          ...dealCards,
          {
            title: "Looking for more?",
            image_url:
              "https://pbs.twimg.com/profile_images/1255914999089750016/-aXwZd27_400x400.jpg",
            subtitle: "Browse deals on Leafly",
            buttons: [
              {
                type: "web_url",
                title: "Shop all deals",
                url: "https://www.leafly.com/deals",
              },
            ],
          },
        ],
      },
    },
  });
}

function sendAccountLookupPrompt(sender_psid) {
  console.log("sendAccountLookupPrompt");
  callSendAPI(sender_psid, {
    text: "How should we look up your account?",
    quick_replies: [
      {
        content_type: "user_phone_number",
        payload: JSON.stringify({
          operation: "order_status_by_phone",
        }),
      },
      {
        content_type: "user_email",
        payload: JSON.stringify({
          operation: "order_status_by_email",
        }),
      },
    ],
  });
}

function sendLearnResponse(sender_psid) {
  console.log("sendLearnResponse");
  callSendAPI(sender_psid, {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: [
          {
            title: "Leafly Cannabis 101",
            image_url:
              "https://leafly-cms-production.imgix.net/wp-content/uploads/2020/06/19081010/Meat-Breath-by-Gromerjuan-Courtesy-Deschutes-Growery.jpg?auto=compress,format&w=745&dpr=1",
            subtitle: "Cannabis education and information",
            buttons: [
              {
                type: "web_url",
                title: "Open",
                url: "https://www.leafly.com/news/cannabis-101",
              },
            ],
          },
        ],
      },
    },
  });
}

function sendOrderStatus(sender_psid, reservation) {
  callSendAPI(sender_psid, {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: [
          {
            title: `Your order is ${orderStatus[reservation.status]}`,
            image_url: reservation.dispensary_logo_url,
            subtitle: reservation.dispensary_name,
            buttons: [
              {
                type: "phone_number",
                title: "Call dispensary",
                payload: "+17023994200",
              },
              {
                type: "web_url",
                title: "View order history",
                url: "https://www-integration.leafly.io/pickup/history",
              },
            ],
          },
        ],
      },
    },
  });
}

async function sendGreeting(sender_psid) {
  callSendAPI(sender_psid, { text: "Welcome to Leafly 👋🏼" });
  await pause();
  callSendAPI(sender_psid, {
    text: "How can we help today?",
    quick_replies: [
      {
        content_type: "text",
        title: "📚 Learn",
        payload: JSON.stringify({ operation: responseOperations.LEARN }),
        image_url: "",
      },
      {
        content_type: "text",
        title: "🛍 Shop",
        payload: JSON.stringify({ operation: responseOperations.SHOP }),
      },
      {
        content_type: "text",
        title: "💰 Browse deals",
        payload: JSON.stringify({ operation: responseOperations.DEALS }),
      },
      {
        content_type: "text",
        title: "📦 Order updates",
        payload: JSON.stringify({ operation: responseOperations.ORDER_STATUS }),
      },
    ],
  });
}

function handlePostback(sender_psid, received_postback) {
  let response;

  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === "yes") {
    response = { text: "Thanks!" };
  } else if (payload === "no") {
    response = { text: "Oops, try sending another image." };
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}

async function pause() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

module.exports = {
  handleMessage,
  handlePostback,
};
