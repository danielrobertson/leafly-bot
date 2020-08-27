const emailValidator = require("email-validator");
const { responseOperations, orderStatus } = require("./constants");
const { callSendAPI, callProfileAPI } = require("./clients/messenger");
const { search } = require("./clients/leafly");
const {
  addConversationState,
  getLastConversationState,
} = require("./data/conversation-state");
const {
  fetchUserByPhone,
  fetchUserByEmail,
  fetchLatestReservationByUser,
  fetchRecentDeals,
} = require("./data/db");

function firstNlpTrait(nlp, name) {
  return nlp && nlp.entities && nlp.traits[name] && nlp.traits[name][0];
}

async function handleMessage(sender_psid, message) {
  console.log(message);
  if (message.text) {
    const isGreeting = firstNlpTrait(message.nlp, "wit$greetings");
    const previousConversationState = getLastConversationState(sender_psid);

    // check if message is part of a multi-step dialogue flow
    if (previousConversationState === responseOperations.SHOP) {
      const searchResults = await search(message.text);
      sendSearchResultsResponse(
        sender_psid,
        searchResults.strain,
        searchResults.product
      );
    } else if (isGreeting && isGreeting.confidence > 0.8) {
      sendGreeting(sender_psid);
    } else if (
      message.text.toLowerCase() === "menu" ||
      message.text.toLowerCase() === "help"
    ) {
      sendMenu(sender_psid);
    } else if (message.text === "420") {
      callSendAPI(sender_psid, {
        text: "Nice 👌🏼",
      });
    } else {
      // check for quick reply tap responses
      if (message.quick_reply && message.quick_reply.payload) {
        const payload = message.quick_reply.payload;
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
          console.log("order updates by phone ", message.text);
          const user = await fetchUserByPhone(message.text.replace("+1", ""));
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
              sendSearchPrompt(sender_psid);
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
                message.quick_reply.payload
              );
          }
        }
      }

      console.log("Catch all-- ", message.text);
    }
  }
}

function handlePostback(sender_psid, received_postback) {
  console.log("handlePostback ", received_postback);
  let payload = received_postback.payload;

  // Delegate actions
  // These postbacks come from Get Started or the persistent menu
  if (payload === responseOperations.START_CONVERSATION) {
    sendGreeting(sender_psid);
  } else if (payload === responseOperations.LEARN) {
    sendLearnResponse(sender_psid);
  } else if (payload === responseOperations.SHOP) {
    sendSearchPrompt(sender_psid);
  } else if (payload === responseOperations.DEALS) {
    sendDealsResponse(sender_psid);
  } else if (payload === responseOperations.ORDER_STATUS) {
    sendAccountLookupPrompt(sender_psid);
  }
}

/**
 * Note this only be set once
 */
// initializeConversationSettings()
function initializeConversationSettings() {
  //set welcome message and the persistent menu
  callProfileAPI({
    get_started: {
      payload: responseOperations.START_CONVERSATION,
    },
  });

  // Known Facebook bug: limit 3 https://developers.facebook.com/support/bugs/843911579346069/
  callProfileAPI({
    persistent_menu: [
      {
        locale: "default",
        composer_input_disabled: false,
        call_to_actions: [
          {
            type: "postback",
            title: "🛍 Shop",
            payload: responseOperations.SHOP,
          },
          {
            type: "postback",
            title: "💰 Browse deals",
            payload: responseOperations.DEALS,
          },
          {
            type: "postback",
            title: "📦 Order updates",
            payload: responseOperations.ORDER_STATUS,
          },
        ],
      },
    ],
  });
}

function sendSearchPrompt(sender_psid) {
  callSendAPI(sender_psid, {
    text: "What are you looking for? I can find products and strain info",
  });
  addConversationState(sender_psid, responseOperations.SHOP);
}

async function sendSearchResultsResponse(sender_psid, strains, products) {
  console.log("sendSearchResultsResponse");
  // TODO find the most pertinent, highest confidence search results to show
  const productCards = products.slice(0, 3).map((product) => {
    return {
      title: product.product.name,
      image_url: product.product.imageUrl,
      subtitle: product.product.shortDescription || product.product.description,
      buttons: [
        {
          type: "web_url",
          title: "Shop",
          url: `https://www.leafly.com/products/details/${product.product.slug}`,
        },
      ],
    };
  });

  const strainCards = strains.slice(0, 3).map((strain) => {
    return {
      title: strain.name,
      image_url:
        strain.nugImage ||
        "https://s3-us-west-2.amazonaws.com/leafly-images/deals/preset/other1.png",
      subtitle: strain.subtitle || strain.shortDescriptionPlain,
      buttons: [
        {
          type: "web_url",
          title: "Shop",
          url: `https://www.leafly.com/strains/${strain.slug}`,
        },
      ],
    };
  });

  // show an assortment of strains and products
  let itemsToShow = [];
  for (let i = 0; i < 4; i++) {
    if (i % 2) {
      if (productCards.length === 0) {
        continue;
      }
      itemsToShow.push(productCards.shift());
    } else {
      if (strainCards.length === 0) {
        continue;
      }
      itemsToShow.push(strainCards.shift());
    }
  }

  callSendAPI(sender_psid, {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: itemsToShow,
      },
    },
  });
}
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
  sendMenu(sender_psid);
}

function sendMenu(sender_psid) {
  callSendAPI(sender_psid, {
    text: "How can we help today?",
    quick_replies: [
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
        title: "📚 Learn",
        payload: JSON.stringify({ operation: responseOperations.LEARN }),
        image_url: "",
      },
      {
        content_type: "text",
        title: "📦 Order updates",
        payload: JSON.stringify({ operation: responseOperations.ORDER_STATUS }),
      },
    ],
  });
}

async function pause() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

module.exports = {
  handleMessage,
  handlePostback,
};
