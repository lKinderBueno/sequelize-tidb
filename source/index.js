// Copyright 2020 The Cockroach Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

'use strict';

// Ensure the user did not forget to install Sequelize.
try {
  require('sequelize');
} catch (_) {
  throw new Error(
    'Failed to load Sequelize. Have you installed it? Run `npm install sequelize`'
  );
  
}
const version_helper = require('./version_helper.js')
const semver = require('semver');
const _ = require("lodash");

const sequelizeVersion = version_helper.GetSequelizeVersion()

if (semver.satisfies(sequelizeVersion, '<=4')) {
  throw new Error(
    `Sequelize versions 4 and below are not supported by sequelize-tidb. Detected version is ${sequelizeVersion}.`
  );
}

require('./query-generator.js')

module.exports = require('sequelize');