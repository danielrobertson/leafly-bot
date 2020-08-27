require("dotenv").config();
const axios = require("axios");

const search = async (searchQuery) => {
  try {
    const url = `${process.env.CONSUMER_API}/search/v1?lat=47.606&lon=-122.332`;
    const response = await axios.get(url, {
      params: {
        q: searchQuery,
      },
      headers: {
        "Access-Control-Allow-Origin": "*",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    console.log(response);
    return response.data.hits;
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  search,
};
