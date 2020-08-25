/**
 * @jest-environment node
 */

const { search } = require("./leafly");
test("e2e leafly consumer-api search endpoint connection", async () => {
  const searchQuery = "blue dream";
  const result = await search(searchQuery);
});
