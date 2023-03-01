require('dotenv').config();
const os = require('os');
const cluster = require('cluster');
const express = require('express');
const createError = require('http-errors');
const packageJSON = require('./package.json');

const app = express();
app.use(express.json());

// multithreading started
const numCPU = os.cpus().length;
if(cluster.isMaster) {
    for(let i=0;i<numCPU;i++) {
        cluster.fork();
    }
    cluster.on('exit',(worker,code,signal)=>{
        console.log(`worker ${worker.process.pid} died`);
        cluster.fork();
    })
} else {
    app.listen(port=process.env.PORT,()=>{
        console.log(`==========> ${packageJSON.name} running on ${process.env.BASE} on thread ${process.pid}`);
    });
}

app.use(process.env.API_LIB,require(process.env.ROUTES_LIB));

// 404 error handler
app.use((req,res,next)=>{
    next(createError(404,'Not found'));
});

// error handler
app.use((error,req,res,next)=>{
    res.status(error.status || process.env.DEFAULT_ERROR_STATUS_CODE);
    res.send({
        error: {
            status: error.status || process.env.DEFAULT_ERROR_STATUS_CODE,
            message: error.message
        }
    })
});