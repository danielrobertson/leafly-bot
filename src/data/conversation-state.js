// TODO refactor this to a persistent MongoDB or even Redis caching layer

/**
 * List of user conversations with a stack of conversation operations
 * e.g. { "psid1234": ["search_select", "order_status_request", etc] }
 */
const userConversationState = {};

const getLastConversationState = (sender_psid) => {
  console.log("conversation state ", userConversationState);
  return (userConversationState[sender_psid] || []).pop();
};

const addConversationState = (sender_psid, operation) => {
  if (!userConversationState[sender_psid]) {
    userConversationState[sender_psid] = [];
  }

  userConversationState[sender_psid].push(operation);
  console.log("conversation state ", userConversationState);
};

module.exports = {
  getLastConversationState,
  addConversationState,
};
