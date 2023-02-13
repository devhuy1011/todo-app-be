# todo-app-be

Guide to run this application:

1. My db i'm using is MySQL. You need have this database fist
(If you don't have a database you can download it from https://dev.mysql.com/downloads/windows/installer/8.0.html version mysql-installer-community) 
2. Open MySQL WorkBench and create new schema name "todo_app"
3. Clone thí project and run npm install
4. Run npm start

How to testing?
1. Download this postman to test (https://drive.google.com/file/d/150XgTwb9_vV0HaDyzLVy1Vp3XpqPwSQh/view?usp=share_link) to test ting api in the Task 
2. Creating WebSocket Request in Postman (If you want to testing socket in Postman)
3. This is all key socket i am using in this project
 - create-todo
 - update-todo
 - delete-todo

 You can see more details in folder server/socket/socketHandle.js
