# nodemysql

A starter node app that is a basic CRUD for a Customer DB in MySQL.

Libraries used:
- Node
- Express (express-myconnection, mysql)
- Bootstrap


Run via:
- node app.js

Manage MySQL connection settings in app.js, you'll need a basic customer table:
- CREATE table customer (id INT NOT NULL PRIMARY KEY AUTO_INCREMENT, name varchar(255), address varchar(255), email varchar(255), phone varchar(255));
