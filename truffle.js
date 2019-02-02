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
    test: {
      host: "localhost",
      port: 8545,
      gas:4712388,
      network_id: "*" // Match any network id
    },
    rinkeby: {
      host: "localhost",
      from: "0x1120336b9a0631d65013dbfe7a68b61b586fc2f7",
      port: 8546,
      gas: 300000,
      gasPrice: 4000000000, // 4 GWei
      network_id: "4" // Match  rinkeby network
    },
    main: {
      host: "localhost",
      from: "0x324ec9421c051d1ec1855ef6fe49263c02b35c77",
      port: 8546,
      gas: 300000,
      gasPrice: 4000000000, // 4 GWei
      confirmations: 2,
      network_id: "1" // Match main network
    }
  },
  solc: {
  optimizer: {
    enabled: true,
    runs: 200
    }
  }
};
