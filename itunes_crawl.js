//why is movie & moviesource getting out of sync?

var mysql = require('mysql');
var request = require('request');
var unique = require('array-unique'); //used to unique an array //unique(['a', 'b', 'c', 'c']);
var dateformatl = require('date-format-lite');

//my modules:
var db = require('dbConnection');
var connection = db();
var moviedata = require('moviedata');



//var INITIAL_URL = 'http://localhost:8080/response.html'; //https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewGrouping?cc=us&id=39'; //Movies Page on iTunes
var INITIAL_URL = 'https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewGrouping?cc=us&id=39'; 
//var INITIAL_URL = 'https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewMultiRoom?cc=us&fcId=678343783';

function parseiTunesURL(url, callback) {
	var options = {
		url : url, //url we are loading
		headers : {
			'X-Apple-Store-Front' : '143441-1,28' //required so that iTunes accepts the request
		}
	};
	request(options, function(error, response, body) {	
		console.log('Parsing ' + url);		
		if (!error && response.statusCode == 200) {				
			var holdar = body.split('its.serverData=');
			var new_response = '';
			if (holdar.length > 1) {
				new_response = holdar[1];			
				hold_ar = new_response.split("</script>");
				new_response = hold_ar[0];
			}

			if (new_response != '') {
				var json_response = {};
				try {
					json_response = JSON.parse(new_response);						
					if (json_response == null) {
						console.log("JSON parsing error");
					}
				} catch (e) {
					console.log('JSON parsing error');
				}

				var hasmovies = false;
				var queuing_movies = true;
				var movies_parsing = 0;
				//loop through all of the Movies on this page
				try {
					if (json_response['storePlatformData']['lockup-room'].hasOwnProperty('results')) {
						var movie_results = json_response['storePlatformData']['lockup-room']['results'];
						for (var key in movie_results) {							
							if (movie_results[key].hasOwnProperty('kind')) {
								if (movie_results[key]['kind'] == "movie") {																	
									hasmovies = true;
									movies_parsing++;							
									//parsing individual movies in parallel...	
									parseMovie(movie_results[key], function() {									
										movies_parsing--;
										isDoneParsing(); //check to see if we're still parsing some
									});
								}
							}
						} //end for loop
					}
					queuing_movies = false;
					isDoneParsing();
				} catch (e) {
					console.log("Error thrown parsing json:" + e);
					clearURL(url, false, function() {
						return callback();
					}); 
				}

				function isDoneParsing() {					
					if (!queuing_movies && movies_parsing == 0) { //if we're done queuing and parsing movies
						if (hasmovies) { //if this URL has movies, add the URL's from the page (this should help keep from crawling all of the non-movie pages)							
							//dont look for URL's on the page to q up until the parsing is done....
							findURLs(new_response, function() {
								clearURL(url, true, function() {
									return callback();
								}); 
							});							
						} else {
							console.log("No Movie Results");
							clearURL(url, false, function() {
								return callback();
							}); 
						}
					}		
				}		
			} else {//if the response is not empty...
				console.log('Empty Response');
				clearURL(url, false, function() {
					return callback();
				});    
			}								
		} else {				
			console.log("HTTP ERROR" + error);
			clearURL(url, false, function() {
				return callback();
			});       	
		}	
	});	
}

function findURLs(raw_response, callback) {
	//look for other Pages (i.e. URL's with MZStore.woa	
	var matches = raw_response.match(/https:\/\/itunes.apple.com\/WebObjects\/MZStore.woa\/(.+?)"/gi);	
												
	function addURL(url) {
		if (matches.length > 0) {
			if (typeof url != 'undefined') {
				url = url.substr(0, url.length - 1); //strip double quote on the end

				connection.query("SELECT count(*) as thecount from itunes_urlq WHERE url = ? ", url, function(err,rows) {
					if (rows[0].thecount == 0) {
						var now = new Date();
						var data = {
							url: url,
							dateadded : now.format("YYYY-MM-DD hh:mm")
						};
						//add it to url_queue table	
						connection.query("INSERT INTO itunes_urlq set ? ", data, function(err,rows) {									
							if (err) throw err;
							//console.log("Successfully inserted into itunes_urlq record with id of " + rows.insertId);
							return addURL(matches.shift());
						});
						//console.log('Inserting url' + data.url);
					} else {
						return addURL(matches.shift());
					}
				});
			} else {
				return addURL(matches.shift());
			}
		} else {
			//all done adding URL's here...
			return callback();
		}
	}
	addURL(matches.shift());
}
function clearURL(url, ihazmovies, callback) {
	//delete this URL from the queue
	var hasmovies = 0;
	if (ihazmovies === true) {
		hasmovies = 1;
	}
	var now = new Date();
	connection.query("UPDATE itunes_urlq SET dateparsed = ?, hasmovies = ? WHERE url = ? ", [now.format("YYYY-MM-DD hh:mm"), hasmovies, url], function(err,rows) {				
		if (err) throw err;
		//console.log('Successfully deleted url');
		return callback();
	});	
}
function parseMovie(movieResults, callback) {
	var prices = new Array();
	var offers = movieResults['offers'];
		
	var movie_year = 0;
	if (movieResults['releaseDate'] !== null) {							
		movie_year = movieResults['releaseDate'].date("YYYY");
	}	

	var movie_name = movieResults['name'];

	//see if this is a director's cut, extended edition, or anniversary edition
	var isEdition = moviedata.detectEdition(movie_name); //blank if not, otherwise the descriptors comma-separated
	
	//normalize the title
	var alt_title = movie_name;	
	movie_name = moviedata.normalizeMovieTitle(movie_name);
	if (alt_title == movie_name) {
		alt_title = '';
	}

	
	var rental_price = 0;
	var purchase_price = 0;
	var rental_price_hd = 0;
	var purchase_price_hd = 0;
	var coming_soon = 0;
	for (var i = 0;i<movieResults['offers'].length;i++) {	
		//hd
		if (movieResults['offers'][i]['actionText'].medium == 'Buy HD') {
			purchase_price_hd = movieResults['offers'][i].price;
		} else if (movieResults['offers'][i]['actionText'].medium == 'Rent HD') {
			rental_price_hd = movieResults['offers'][i].price;
		} else if (movieResults['offers'][i]['actionText'].medium == 'Pre-Order HD') {
			purchase_price_hd = movieResults['offers'][i].price;
			coming_soon = 1;
		} else if (movieResults['offers'][i]['actionText'].medium == 'Buy') { //non-HD
			purchase_price = movieResults['offers'][i].price;
		} else if (movieResults['offers'][i]['actionText'].medium == 'Rent') {
			rental_price = movieResults['offers'][i].price;
		} else if (movieResults['offers'][i]['actionText'].medium == 'Pre-Order') {
			purchase_price = movieResults['offers'][i].price;
			coming_soon = 1;
		}		
	}

	var movieobj = {
		source : 'itunes',
		source_id : movieResults['id'], 
		movie_name : movie_name,
		alt_title : alt_title,
		movie_year : movie_year,
		rating : movieResults['contentRating'].name, 
		releaseDate : movieResults['releaseDate'],
		rental_price : rental_price,
		rental_price_hd : rental_price_hd,
		purchase_price : purchase_price,
		purchase_price_hd : purchase_price_hd,
		coming_soon : coming_soon,
		isEdition : isEdition
	};
	
	moviedata.captureMovie(movieobj, callback); //~~~ Action: Update Movies Table & MovieSource Tables	
}

connection.connect();	

var now = new Date();
connection.query("SELECT url FROM itunes_urlq WHERE (dateparsed < ? OR dateparsed IS NULL) AND hasmovies = 1 ORDER by rand()", now.format("YYYY-MM-DD"), function(err, rows, fields) {
    if (err) {
    	console.log("Query error: " + err);
    	//throw err;
    	return;
    }    

 	var url_queue = new Array(); // 
 	if (rows.length > 0) { 	
    	for (var i in rows) {
    		url_queue.push(rows[i].url);	        
	    }
	} else {
		//if empty, start with INITIAL_URL
		url_queue.push(INITIAL_URL);		
	}	
	function loadNext(url) {
		if (url) {
			parseiTunesURL(url, function() {
				return loadNext( url_queue.shift() ) ;
			});
		} else {
			return complete();
		}
	}
	loadNext(url_queue.shift());	
});
		
function complete() {
	connection.end(); //close the mysql connection
	console.log('Done looping through URLs');
}
