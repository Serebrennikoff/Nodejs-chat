const fs = require('fs');

let count = 0,
		clients = {},
		users = [],
		messagesDB = [];

function associateMsgWithPhoto() {
	users.forEach( user => {
		for(let msg of messagesDB) {
			if(user.nickname === msg.authorNick) {
				msg.authorPhoto = user.photo || 'images/default.png';
			}
		}
	});
}

exports.manageUser = function(userData) {

	let usersNowOnline = [];
	users.filter( user => {
		return user.isOnline;
	}).forEach( user => {
		usersNowOnline.push({
			name: user.realname,
			nick: user.nickname
		});
	});

	let authorizedBefore = false;
	for(let user of users) {
		// Проверка наличия пользователя с таким ником в массиве
		if(user.nickname === userData.nickname) {
			// Если пользователь есть, но уже авторизован - выбрасывается исключение
			if(user.isOnline) throw new Error('Пользователь с таким ником уже авторизован')
			// Если пользователь есть, ему присваивается id в данной сессии и статус онлайн, его объект возвращается
			else {
				authorizedBefore = true;
				user.currentSessionId = ++count;
				user.isOnline = true;
				associateMsgWithPhoto();
				user.messageHistory = messagesDB;
				let data = {
					otherUsersOnline: usersNowOnline,
					user: user
				};
				return JSON.stringify(data);
			}	
		}
	}
	// Если пользователь ранее не авторизовывался, он добавляется в массив
	if(!authorizedBefore) {
		userData.currentSessionId = ++count;
		userData.isOnline = true;
		userData.otherUsersOnline = usersNowOnline;
		users.push(userData);
		let data = {
			otherUsersOnline: usersNowOnline,
			user: userData
		};
		return JSON.stringify(data);
	}
};

exports.getNumOfUsersOnline = function() {
	return Object.keys(clients).length;
};

exports.addClient = function(connection) {
	let id = count;
	clients[id] = connection;
	console.log((new Date()) + 'Connection accepted ' + id);
	return id;
};

exports.sendMsgToClients = function(message) {
	for(let i in clients) {
		clients[i].sendUTF(message);
	}
};

exports.removeClient = function(id) {
	delete clients[id];
	console.log((new Date()) + ' ' + id + ' disconnected');
};

exports.getUserLeft = function(id) {
	let userNickname;
	users.forEach( user => {
		if(user.currentSessionId === id) {
			user.isOnline = false;
			userNickname = user.nickname;
		}
	});
	return userNickname;
};

exports.addMsgToDB = function(message) {
	if(messagesDB.length >= 50) {
		messagesDB.splice(0, 1);
	}
	messagesDB.push(message);
};

exports.addUserPhoto = function(photo, owner) {
	let base64Data = photo.replace(/^data:image\/(png|jpg|jpeg|gif);base64,/,"");
	fs.writeFile(`./images/${owner}-photo.jpg`, base64Data, 'base64', function(err) {
		if (err) throw new Error(err);
	});
	for(let user of users) {
		if(user.nickname === owner) {
			return user.photo = `images/${owner}-photo.jpg`;
		}
	}
};

exports.getAuthorPhoto = function(author) {
	for(let user of users) {
		if(user.nickname === author) {
			return user.photo;
		}
	}
};