require('babel-register');
require('babel-polyfill');

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      gas:4712388,
      network_id: "*" // Match any network id
    },
    rinkeby: {
      host: "localhost",
      from: "0xb658369b9338b4d42021692e6ae1a4992af51124",
      port: 8546,
      gas:4712388,
      network_id: "4" // Match any network id
    }
  },
  solc: {
  optimizer: {
    enabled: true,
    runs: 200
    }
  }
};
