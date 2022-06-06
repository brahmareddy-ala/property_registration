'use strict';

const {Contract, Context} = require('fabric-contract-api');

const User = require('./lib/models/user.js');
const Property = require('./lib/models/property.js');
const UserList = require('./lib/lists/userlist.js');
const PropertyList = require('./lib/lists/propertylist.js');

class RegistrarContext extends Context {
	constructor() {
		super();
		// this : the context instance
		this.userList = new UserList(this);
		this.propertyList = new PropertyList(this);
	}
}

class RegistrarContract extends Contract {
	
	constructor() {
		// Custom name to refer to this smart contract
        super('org.property-registration-network.registrar');
	}
	
	// // Built in method used to build and return the context for this smart contract on every transaction invoke
	createContext() {
		return new RegistrarContext();
	}
	
	/* ****** All custom functions are defined below ***** */
	
	// This is a basic user defined function used at the time of instantiating the smart contract
	// to print the success message on console
	async instantiate(ctx) {
		console.log('Registrar Smart Contract Instantiated');
	}
	
	/**
	 * approve a new user request on the property registration network
	 * @param ctx - The transaction context object
	 * @param name - Name of the user
     * @param aadhar - Aadhar number of the user
	 * @returns
	 */
	async approveNewUserRequest(ctx, name, aadhar) {
		if (ctx.clientIdentity.getMSPID() != "registrarMSP") {
            throw new Error("Registrar's can only approve new user request");
        }
		// Create a new composite key for the new user
		let userKey = User.makeKey([name, aadhar]);
		const userCompositeKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.user.", [userKey]);
		
		// Fetch new user request object with given name and aadhar from the ledger
		let userRequestBuffer = await ctx.stub
				.getState(userCompositeKey)
				.catch(err => console.log("Error while fetching User Request object " + err));
		
		let userRequestObj;
		try {
			userRequestObj = JSON.parse(userRequestBuffer.toString());			
		}catch(err) {			
			userRequestObj = undefined;
		}
		
		// Make sure user exists.
		if (userRequestObj === undefined) {
			throw new Error('The new user request for name ' + name + ' and aadhar ' + aadhar + ' does not exists.');
		} else {
			// Add upgradCoins property to user & create a new instance of user model and save it to ledger
			userRequestObj.upgradCoins = 0;
			let userObj = User.createInstance(userRequestObj);
			await ctx.userList.addUser(userObj);

			// Return value of new user object
			return userObj;
		}
	}
	
	/**
	 * This function should be defined to view the current state of any user
	 * @param ctx - The transaction context
	 * @param name - name for which to fetch details
	 * @param aadhar - aadhar for which to fetch details
	 * @returns {Object}
	 */
	async viewUser(ctx, name, aadhar) {
		const userKey = User.makeKey([name, aadhar]);
		const userCompositeKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.user.", [userKey]);
		
		// Fetch user with given name and aadhar from blockchain
		let userBuffer = await ctx.stub
				.getState(userCompositeKey)
				.catch(err => console.log("Error while fetching user" + err));
		
		let userObj;
		try {
			userObj = JSON.parse(userBuffer.toString());			
		}catch(err) {			
			userObj = undefined;
		}

		// Make sure user exist.
		if (userObj === undefined) {
			throw new Error('There is no user with name ' + name + ' and aadhar ' + aadhar + ' exists');
		} else {
			return userObj;
		}
	}
	
	/**
	 * This function is used by the registrar to create a new ‘Property’ asset on the network after
	 *  performing certain manual checks on the request received for property registration
	 * @param ctx
	 * @param propertyId
	 * @returns {Property}
	 */
	async approvePropertyRegistrationRequest(ctx, propertyId) {
		if (ctx.clientIdentity.getMSPID() != "registrarMSP") {
            throw new Error("Registrar's can only approve property registration request");
        }
		// Create a composite key for the property
		const propertyKey = Property.makeKey([propertyId]);
		const propertyCompositeKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.property.", [propertyKey]);
		
		// // Fetch user with given name and aadhar from blockchain
		let propertyRequestBuffer = await ctx.stub
				.getState(propertyCompositeKey)
				.catch(err => console.log("Error while fetching Property Request object " + err));

		let propertyRequestObj;		
		try {
			propertyRequestObj = JSON.parse(propertyRequestBuffer.toString());			
		}catch(err) {			
			propertyRequestObj = undefined;
		}
		
		// Make sure that student already exists and certificate with given ID does not exist.
		if (propertyRequestObj === undefined) {
			throw new Error('Property with propertyId ' + propertyId + " does not exists.");
		} else {
			propertyRequestObj.status = "registered";
			let property = Property.createInstance(propertyRequestObj);
			await ctx.propertyList.addProperty(property);
			return property;
		}
	}

	/**
	 * This function should be defined in order to view the current state 
	 * of any property registered on the ledger.
	 * @param ctx - The transaction context
	 * @param propertyId - propertyId for which to fetch details
	 * @returns {Property}
	 */
	 async viewProperty(ctx, propertyId) {
		// Create the composite key required to fetch record from blockchain
		const propertyKey = Property.makeKey([propertyId]);

		// Fetch property with given propertyId from blockchain
		let propertyObj = ctx.propertyList
				.getProperty(propertyKey)
				.catch(err => console.log("Error while fetching property " + err));

		// Make sure property exist.
		if (propertyObj === undefined) {
			throw new Error('There is no registered property with propertyId ' + propertyId + " exists");
		} else {
			return propertyObj;
		}
	}
}

module.exports = RegistrarContract;