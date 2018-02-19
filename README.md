## Contracts

Smart Contracts that implement dicether's state channel.<br>
It is released under the [AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.en.html).

### Install dependencies
```bash
    npm install
```

### Build
```bash
    npm build
```

### Run tests
You need to have a running ganache instance. As we are using
eth_signTypedData which is currently not implemented by ganache we are
use a custom implementation. Therefore ganache needs to be
started with --mnemonic "test" to use the correct private keys.
```bash
    ganache-cli -e=1000 --mnemonic "test"
```

Then you can run tests with
```bash
    npm run test
```
