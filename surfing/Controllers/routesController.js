const createError = require('http-errors');
const Redis = require('redis');
const https = require('https');
// creating redisClient
const redisClient = Redis.createClient();
(async () => {
    await redisClient.connect();
})();

redisClient.on('connect', () => console.log(`==========> redisClient Connected on thread ${process.pid}`));
redisClient.on('error', (error) => console.log(`==========> redisClient Connection Error on thread ${process.pid}`, error));
// resuming routesController logic
module.exports = {
    apiCALL: async(req,res,next)=>{
        var city = process.env.CITY.split(';'), cityData = [], count = 0, date = [], dateU = [], temp = [], final = [];
        console.log(`key: ${req.url}`);
        const cached_lookup = await redisClient.get(req.url);
        // console.log(cached_lookup);
        if(cached_lookup) {
            console.log(`cache hit`);
            res.send(JSON.parse(cached_lookup));
            return;      
        }
        try {
            console.log(`cache miss`);
            city.map((value)=>{
                fetchWeatherData(process.env.CITY1+value+process.env.CITY2,value)
                .then(result=>{
                    var cityArray = result;
                    count++;
                    if(cityArray.length > 0) {
                        cityData.push(cityArray);
                        var e = cityArray.length, m = '';
                        e === 1 ? m = `${value} has 1 entry.` : m = `${value} has ${e} entries.`;
                        console.log(m);
                    }
                    if(count === city.length) {
                        cityData.flat().map((value)=>{date.push(value[1].split('-').reverse().join(''))});
                        [...new Set(date)].sort((a,b)=>{return a-b}).map((valueD,i)=>{
                            dateU[i] = `${valueD.substr(4,4)}-${valueD.substr(2,2)}-${valueD.substr(0,2)}`;
                        });
                        dateU.map((v0)=>{
                            temp = cityData.flat().filter(v1=>v1[1]===v0).sort((a,b)=>{return b[4]-a[4]});
                            // console.log(temp[0]);
                            final.push({"city":temp[0][0],
                            "date":temp[0][1],
                            "wind":temp[0][2],
                            "temp":temp[0][3],
                            "location":temp[0][4]});
                            temp = [];
                        });
                        redisClient.setEx(req.url,process.env.EXPIRE_TIME,JSON.stringify(final));
                        res.json(final);
                    }
                });
            });
        } catch (error) {
            console.log(error.message);
        }
    }
}

// fetch data
function fetchWeatherData(cityURL,cityName) {
    return new Promise((resolve,reject)=>{
        https.get(cityURL,(res)=>{
            let rec = ''
            res.on('data',(d)=>{
                rec += [d]
            }).on('end',()=>{
                try {
                    if(rec!=null) {
                        var max_temp = [], min_temp = [], avg_temp = [], wind_spd = [], date = [], location = [], cityArray = [];
                        max_temp = rec.match(/"max_temp":[+-]?\d+(\.\d+)\w*/g).map(value=>parseFloat(value.replaceAll(/("|:|max_temp|')/g,'')));
                        min_temp = rec.match(/"min_temp":[+-]?\d+(\.\d+)\w*/g).map(value=>parseFloat(value.replaceAll(/("|:|min_temp|')/g,'')));
                        wind_spd = rec.match(/"wind_spd":[+-]?\d+(\.\d+)\w*/g).map(value=>parseFloat(value.replaceAll(/("|:|wind_spd|')/g,'')));
                        date = rec.match(/"datetime":?"\d{4}\-(0?[1-9]|1[012])\-(0?[1-9]|[12][0-9]|3[01])"\w*/g).map(value=>value.replaceAll(/("|:|datetime|')/g,''));
                    
                        max_temp.map((value,i)=>{
                            avg_temp.push(((value+min_temp[i])/2).toFixed(2));
                            location.push(parseFloat((wind_spd[i] * 3 + parseFloat(value)).toFixed(2)));
                        });
                        avg_temp.map((value,i)=>{
                            if(wind_spd[i] >= 5 && wind_spd[i] <= 18 && value >= 5 && value <= 35) {
                                cityArray.push([cityName,date[i],wind_spd[i],parseFloat(value),location[i]]);
                            }
                        });
                        resolve(cityArray);
                    }
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error',(error)=>{
            console.log(error);
        });
    });
}