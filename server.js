const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = process.env.PORT || 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  let waitingUser = null;
  let onlineUsers = 0;

  io.on('connection', (socket) => {
    onlineUsers++;
    io.emit('online_count', onlineUsers + 15000); // base padding

    socket.on('start_search', () => {
      if (waitingUser && waitingUser !== socket) {
        // Match found!
        const partner = waitingUser;
        waitingUser = null;

        const room = `room_${socket.id}_${partner.id}`;
        socket.join(room);
        partner.join(room);

        socket.partnerRoom = room;
        partner.partnerRoom = room;

        socket.emit('match_found');
        partner.emit('match_found');
      } else {
        waitingUser = socket;
      }
    });

    socket.on('send_message', (msg) => {
      if (socket.partnerRoom) {
        socket.to(socket.partnerRoom).emit('receive_message', msg);
      }
    });

    socket.on('typing', (isTyping) => {
      if (socket.partnerRoom) {
        socket.to(socket.partnerRoom).emit('partner_typing', isTyping);
      }
    });

    const handleDisconnect = () => {
      if (waitingUser === socket) {
        waitingUser = null;
      }
      if (socket.partnerRoom) {
        socket.to(socket.partnerRoom).emit('partner_disconnected');
        socket.leave(socket.partnerRoom);
        socket.partnerRoom = null;
      }
    };

    socket.on('stop_search', handleDisconnect);
    socket.on('leave_chat', handleDisconnect);

    socket.on('disconnect', () => {
      onlineUsers--;
      io.emit('online_count', onlineUsers + 15000);
      handleDisconnect();
    });
  });

  server.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
