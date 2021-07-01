# Pi Network SDK

[![GitHub](https://img.shields.io/github/license/PiNetwork-js/sdk)](https://github.com/PiNetwork-js/sdk/blob/main/LICENSE.md)
[![npm](https://img.shields.io/npm/v/@pinetwork-js/sdk?color=crimson&logo=npm)](https://www.npmjs.com/package/@pinetwork-js/sdk)

**Unofficial** Pi Network SDK

## Features

- An uncompiled (rewritten) version of the SDK
- True Typescript support

## Installation

Install with [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com):

```sh
npm install @pinetwork-js/sdk
yarn add @pinetwork-js/sdk
```

### Usage

```js
const { Pi } = require('@pinetwork-js/sdk');

Pi.init({ version: '2.0' });
```

```ts
import { Pi } from '@pinetwork-js/sdk';

Pi.init({ version: '2.0' });
```

### Documentation

- Official [documentation](https://github.com/pi-apps/pi-platform-docs/blob/master/SDK_reference.md) from the Pi Network Core Team (you don't need to write the types, the package includes them)