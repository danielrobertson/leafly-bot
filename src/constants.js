const orderStatus = {
  0: "pending",
  1: "confirmed",
  2: "ready",
  5: "out for delivery",
  6: "delivered",
  3: "picked up",
  4: "canceled",
};

const responseOperations = {
  LEARN: "learn",
  SHOP: "shop",
  DEALS: "deals",
  ORDER_STATUS: "order_status",
  START_CONVERSATION: "start",
};

module.exports = {
  orderStatus,
  responseOperations,
};
