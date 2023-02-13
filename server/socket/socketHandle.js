
const SocketServer = require("socket.io");
const db = require('../config/connectDB');
import response from '../utils/response';


let io;
//instance of server

const connectionList = {
    "socketId": {
        socketInstance: "instance socket",
        // walletAddress: "walletAddress"
    }
}

class SocketUtils {

    static init(app, host, socketPort) {
        console.log("init socket", socketPort);
        if (io) return;
        try {
            const server = app.listen(socketPort, function () {
                console.log(`Socket is listening on ${host}:${socketPort}`);

            });
            io = new SocketServer.Server(server, {
                cors: {
                    origin: "*"
                    // methods: ["GET"]
                    // allowedHeaders: ["header"],
                    // credentials: true
                },
                // reconnection: true
            });



            io.on("connection", (socketInstance) => {
                console.log('user connected');

                this.addConnectionToList(socketInstance);
                this.updateConnectionToList(socketInstance);
                this.deleteConnectionToList(socketInstance);

            })

            
            setInterval(() => {
                try{
                    console.log("number sockets connection:", io.engine.clientsCount);
                }catch(e){
                    
                }
            }, 5000);


        } catch (error) {
            console.log(error);
        }
    }
    static addConnectionToList(socketInstance, ) {
        socketInstance.on('create-todo', async (dataCreated) => {
            try {
                const connection = db('todo');
                let {
                    title,
                    description,
                    completed
                } = dataCreated;

                const dataToBeInserted = {
                    title,
                    description,
                    completed
                };
                await connection.insert(dataToBeInserted, ['id']);

                socketInstance.broadcast.emit("create-todo-response", {
                    message: `Create todo successful!`,
                    data: dataToBeInserted,
                });


            } catch (e) {
                console.log(e)
            }
        })
    }
    static async updateConnectionToList(socketInstance) {
        socketInstance.on('update-todo', async (dataUpdated) => {
            try {
                const connection = db('todo');
                let {
                  idTodo,
                  title,
                  description,
                  completed
                } = dataUpdated;
          
                const infoUpdate = { };
            
                const todo = await connection.select(["todo.*"])
                  .where({ 'todo.id': idTodo }).first();
                if (!todo) {
                  return response.ERROR(404, 'Not found', "todo_404");
                }
          
                if (title != null) {
                  infoUpdate.title = title
                }
                if (description != null) {
                  infoUpdate.description = description
                }
                if (completed != null) {
                  infoUpdate.completed = completed
                }
          
                await connection.update(infoUpdate).where({ id: idTodo });
                
                socketInstance.broadcast.emit("update-todo-response", {
                    message: `Update todo successful!`
                });

            } catch (e) {
                console.log(e)
            }
        })
    }
    static async deleteConnectionToList(socketInstance) {
        socketInstance.on('delete-todo', async (data) => {
            try {
                const connection = db('todo');
                const todo = await connection.select(["todo.*"])
                .where({ 'todo.id': data.id }).first();
                if (!todo) {
                return response.ERROR(404, 'Not found', "todo_404");
                }
                
                await connection.delete({ id: data.id });
                
                socketInstance.broadcast.emit("delete-todo-response", {
                    message: `Delete todo successful!`
                });

            } catch (e) {
                console.log(e)
            }
        })
    }
}

export default SocketUtils