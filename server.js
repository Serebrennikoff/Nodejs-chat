const fs = require('fs');

const model = require('./model');

const http = require('http');
const url = require('url');
const WebSocketServer = require('websocket').server;


const server = http.createServer( (req, res) => {
	let urlParsed = url.parse(req.url);

	if(urlParsed.pathname === '/ws') {
		let connectedUser;

		req.on('data', function(chunk) {
			connectedUser = JSON.parse(chunk);
		});

		req.on('end', function() {	
			try{
				responseBody = model.manageUser(connectedUser);
				res.writeHead(200, "OK", {'Content-Type': 'application/json'});
				res.write(responseBody);
			} catch(e) {
				res.writeHead(400, "Bad Request");
				res.write(e.message);
			}
      res.end();
		});
	} else {
		try {
			sendResource(urlParsed.pathname, res);
		} catch(e) {
			res.statusCode = 404;
			res.end('Not Found');
		}
	}
}).listen(3000);

const wsServer = new WebSocketServer({
	httpServer: server,
	maxReceivedFrameSize: "512KiB"
});

wsServer.on('request', function(req) {
	let connection = req.accept('echo-protocol', req.origin);
	let id = model.addClient(connection);

	connection.on('message', function(message) {
		message = JSON.parse(message.utf8Data);
		let messageType = message.type;

		switch(messageType) {
			case 'user':
				message.usersOnline = model.getNumOfUsersOnline();
				model.sendMsgToClients(JSON.stringify(message));
				break;
			case 'message':
				model.addMsgToDB(message);
				message.authorPhoto = model.getAuthorPhoto(message.authorNick);
				model.sendMsgToClients(JSON.stringify(message));
				break;
			case 'photo':
				let photoPath = model.addUserPhoto(message.photo, message.photoOwner);
				message = {
					type: 'photo',
					owner: message.photoOwner,
					path: photoPath
				};
				model.sendMsgToClients(JSON.stringify(message));
				break;
		}

	});

	connection.on('close', function(reasonCode, description) {
		model.removeClient(id);
		let message = {
			type: 'onlogout',
			userLeft: model.getUserLeft(id),
			usersOnline: model.getNumOfUsersOnline()
		};	
		model.sendMsgToClients(JSON.stringify(message));
	})
});

function sendResource(resourcePath, res) {
	if(resourcePath === '/') resourcePath = 'index.html';
	else resourcePath = __dirname + resourcePath;

	fs.stat(resourcePath, function(err) {
		if(err) throw new Error()

		let fileExtension = resourcePath.slice(resourcePath.lastIndexOf('.')+1);
		switch(fileExtension) {
			case 'html':
			case 'css':
				fileExtension = `text/${fileExtension}`;
				break;
			case 'js':
				fileExtension = `application/${fileExtension}`;
				break;
			case 'png':
			case 'jpg':
				fileExtension = `image/${fileExtension}`;
				break;
		}

		fs.readFile( resourcePath, function(err, data) {
				res.writeHead(200, {'Content-Type': fileExtension});
				res.write(data);
				res.end();
		});
	});
} 