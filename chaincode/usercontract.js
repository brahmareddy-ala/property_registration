'use strict';

const {Contract, Context} = require('fabric-contract-api');

const User = require('./lib/models/user.js');
const Property = require('./lib/models/property.js');
const UserList = require('./lib/lists/userlist.js');
const PropertyList = require('./lib/lists/propertylist.js');

const VALID_TRANSACTIONS = {
	'upg100' : 100,
	'upg500' : 500,
	'upg1000' : 1000
};

const PROPERTY_STATUS = {
	'REGISTERED': 'registered',
	'ON_SALE': 'onSale'
};

class UserContext extends Context {
	constructor() {
		super();
		// this : the context instance
		this.userList = new UserList(this);
		this.propertyList = new PropertyList(this);
	}
}

class UserContract extends Contract {
	
	constructor() {
		// Custom name to refer to this smart contract
		super('org.property-registration-network.user');
	}
	
	// Built in method used to build and return the context for this smart contract on every transaction invoke
	createContext() {
		return new UserContext();
	}
	
	/* ****** All custom functions are defined below ***** */
	
	// This is a basic user defined function used at the time of instantiating the smart contract
	// to print the success message on console
	async instantiate(ctx) {
		console.log('User Smart Contract Instantiated');
	}
	
	/**
	 * This transaction is called by the user to request the registrar to register 
	 * them on the property-registration-network
	 * @param ctx - The transaction context object
	 * @param name - Name of the user
	 * @param email - Email ID of the user
     * @param phone - Phone number of the user
     * @param aadhar - Aadhar number of the user
	 * @returns {Object}
	 */
	async requestNewUser(ctx, name, email, phone, aadhar) {
		if (ctx.clientIdentity.getMSPID() != "usersMSP") {
			throw new Error("Only users should be allowed to raise a new user request");
		}
		// Create a new composite key for the new user
		let userKey = User.makeKey([name, aadhar]);
		const userCompositeKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.user.", [userKey]);
		
		// Fetch user with given name and aadhar from ledger
		let userBuffer = await ctx.stub.getState(userCompositeKey).catch(err => console.log(err));
		let existingUser;
		
		try {
			existingUser = JSON.parse(userBuffer.toString());			
		}catch(err) {			
			existingUser = undefined;
		}
		if (existingUser !== undefined) {
			if(existingUser.upgradCoins >= 0)
				throw new Error('User with name ' + name + ' and aadhar ' + aadhar + ' already exists');
			else
				throw new Error('User Registration Request for name ' + name + ' and aadhar ' + aadhar + 'is already exists');
		}
		else {
			// Create a request object to be stored in ledger
			let userObj = {
				name: name,
				email: email,
				phone: phone,
				aadhar: aadhar,
				createdAt: new Date(),
			};
			// saving the request object  to ledger
			await ctx.stub.putState(userCompositeKey, Buffer.from(JSON.stringify(userObj)));

			// Return value of new request object
			return userObj;
		}
	}

	/**
	 * Recharge a user account with some value on the property registration network
	 * @param ctx - The transaction context object
	 * @param name - Name of the user
     * @param aadhar - Aadhar number of the user
	 * @param transactionID - Bank transaction id of the user
	 * @returns
	 */
	 async rechargeAccount(ctx, name, aadhar, transactionID) {
		if (ctx.clientIdentity.getMSPID() != "usersMSP") {
			throw new Error("Only users should be allowed to recharge accounts");
		}
		
		let upgradCoins = 0;
		if(VALID_TRANSACTIONS[transactionID]) {
			upgradCoins = VALID_TRANSACTIONS[transactionID];
		} else {
			throw new Error('Invalid Bank Transaction ID');
		}
		
		const userKey = User.makeKey([name, aadhar]);
		let user = await ctx.userList
				.getUser(userKey)
				.catch(err => console.log("Error while fetching user " + err));

		// Make sure user does not already exist.
		if (user === undefined) {
			throw new Error('There is no user with name ' + name + ' and aadhar ' + aadhar + ' exists');
		} else {
			user.upgradCoins += upgradCoins;
			await ctx.userList.updateUser(user);
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
	 * This function should be initiated by the user to register the details of their 
	 * property on the property registration network.
	 * @param ctx
	 * @param name
	 * @param aadhar
	 * @param propertyId
	 * @param owner
	 * @param price
	 * @param status
	 * @returns {Object}
	 */
	async propertyRegistrationRequest(ctx, name, aadhar, propertyId, price) {
		if (ctx.clientIdentity.getMSPID() != "usersMSP") {
			throw new Error("Only users should be used to raise property registration request");
		}
		// Create a composite key for the user
		const userKey = User.makeKey([name, aadhar]);
		
		// Create a composite key for the property
		const propertyKey = Property.makeKey([propertyId]);
		const propertyCompositeKey = ctx.stub.createCompositeKey("org.property-registration-network.regnet.property.", [propertyKey]);
		
		// Fetch user with given name and aadhar from blockchain
		let propertyBuffer = await ctx.stub
				.getState(propertyCompositeKey)
				.catch(err => console.log(err));

		let property;
		try {
			property = JSON.parse(propertyBuffer.toString());			
		}catch(err) {			
			property = undefined;
		}

		if (property !== undefined) {
			if (property.status == PROPERTY_STATUS.REGISTERED)
				throw new Error('Property with propertyId ' + propertyId + 'is already exists');
			else
				throw new Error('Property Registration request for propertyId ' + propertyId + 'is already exists');
		}

		// Fetch user with given name and aadhar from blockchain
		let user = await ctx.userList
				.getUser(userKey)
				.catch(err => console.log(err));
		
		// Make sure that student already exists and certificate with given ID does not exist.
		if (user === undefined) {
			throw new Error('There is no approved user with name ' + name + ' and aadhar ' + aadhar + ' exists');
		} else {
			let propertyObj = {
				propertyId: propertyId,
				owner: userKey,
				price: price
			};
			await ctx.stub.putState(propertyCompositeKey, Buffer.from(JSON.stringify(propertyObj)));
			return propertyObj;
		}
	}

	/**
	 * Get a property details from the blockchain
	 * @param ctx - The transaction context
	 * @param propertyId - propertyId for which to fetch details
	 * @returns {Property}
	 */
	 async viewProperty(ctx, propertyId) {
		// Create the composite key required to fetch record from blockchain
		const propertyKey = Property.makeKey([propertyId]);
		
		// Fetch property with given propertyId from blockchain
		let propertyObj = await ctx.propertyList
				.getProperty(propertyKey)
				.catch(err => console.log("Error while fetching property " + err));

		// Make sure property exist.
		if (propertyObj === undefined) {
			throw new Error('There is no registered property with propertyId ' + propertyId + ' exists');
		} else {
			return propertyObj;
		}		
	}

	/**
	* This function is invoked in order to change the status of a property
	* @param ctx
	* @param name
	* @param aadhar
	* @param propertyId
	*/
	async updateProperty(ctx, name, aadhar, propertyId, status) {
		const userKey = User.makeKey([name, aadhar]);
		const propertyKey = Property.makeKey([propertyId]);

		let propertyObj = await ctx.propertyList
				.getProperty(propertyKey)
				.catch(err => console.log("Error while fetching property " + err));

		if (propertyObj === undefined) {
			throw new Error('Property with propertyId ' + propertyId + ' does not exists');
		} else {
			if(propertyObj.owner === userKey) {
				if(status === PROPERTY_STATUS.REGISTERED || status === PROPERTY_STATUS.ON_SALE)
				{	propertyObj.status = status;
					await ctx.propertyList.updateProperty(propertyObj);
				}
				else
					throw new Error("The input value of the status should be either registered or onSale");
			}
			else {
				throw new Error("Only authorized users can update the value of this property");
			}
		}
	}

	/**
	* The properties listed for sale can be purchased by a user registered on the network.
	* @param ctx
	* @param name
	* @param aadhar
	* @param propertyId
	*/
	async purchaseProperty(ctx, name, aadhar, propertyId) {
		const userKey = User.makeKey([name, aadhar]);
		let user = await ctx.userList
				.getUser(userKey)
				.catch(err => console.log(err));

		const propertyKey = Property.makeKey([propertyId]);
		let property = await ctx.propertyList
				.getProperty(propertyKey)
				.catch(err => console.log(err));

		if (user === undefined || property === undefined) {
			throw new Error('There is no user with name ' + name + ' and aadhar ' + aadhar + ' exists \n OR \n'
			+ ' There is no registered property with propertyId ' + propertyId + ' exists');
		}

		if(property.status === PROPERTY_STATUS.ON_SALE) {
			if (user.upgradCoins >= property.price) {
				let oldOwnerKey = property.owner;
				let oldOwner = await ctx.userList
					.getUser(oldOwnerKey)
					.catch(err => console.log(err));

				property.status = PROPERTY_STATUS.REGISTERED;
				user.upgradCoins -= property.price;
				oldOwner.upgradCoins += property.price;
				property.owner = userKey;

				await ctx.propertyList.updateProperty(property);
				await ctx.userList.updateUser(user);
				await ctx.userList.updateUser(oldOwner);
			}
			else {
				throw new Error("There are no sufficient funds for the user with name " + name + 
				" and aadhar " + aadhar + " to purchase this property");
			}		
		}
		else {
			throw new Error("The property with propertyId " + propertyId + " is not onSale");
		}
	}
}

module.exports = UserContract;