'use strict';

const usercontract = require('./usercontract.js');
const registrarcontract = require('./registrarcontract.js');
module.exports.usercontract = usercontract;
module.exports.registrarcontract = registrarcontract;
module.exports.contracts = [usercontract, registrarcontract];