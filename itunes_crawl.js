//am i getting TV shows?
//why is movie & moviesource getting out of sync?
//why does it crash...

var mysql = require('mysql');
var request = require('request');
var unique = require('array-unique'); //used to unique an array //unique(['a', 'b', 'c', 'c']);
var dateformatl = require("date-format-lite");

//var INITIAL_URL = 'http://localhost:8080/response.html'; //https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewGrouping?cc=us&id=39'; //Movies Page on iTunes
var INITIAL_URL = 'https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewGrouping?cc=us&id=39'; 
var connection = mysql.createConnection(
    {
      host     : 'localhost',
      user     : 'root',
      password : 'root',
      database : 'movieapp',
    }
);


function parseiTunesURL(url) {
	console.log("Parsing URL:" + url);			
	var options = {
		url : url, //url we are loading
		headers : {
			'X-Apple-Store-Front' : '143441-1,28' //required so that iTunes accepts the request
		}
	};
	request(options, function(error, response, body) {	
			console.log('Response for: ' + url);		
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

					//loop through all of the Movies on this page
					try {
						var movie_results = json_response['storePlatformData']['lockup-room']['results'];
						for (var key in movie_results) {
							parseMovie(movie_results[key]);										
						} //end for loop
					} catch (e) {
						console.log("No Movie Results");
					}
					//look for other Pages (i.e. URL's with MZStore.woa
					//var matches = new_response.match(/https:\/\/itunes.apple.com\/WebObjects\/MZStore.woa\/.+$/);
					var matches = new_response.match(/https:\/\/itunes.apple.com\/WebObjects\/MZStore.woa\/(.+?)"/gi);
					//console.log(matches);						
						for(var i = 0;i<matches.length;i++) {
							matches[i] = matches[i].substr(0, matches[i].length - 1); //strip double quote on the end
							//@@@add it to url_queue table	
							var data = {
								url: matches[i]
							};
							connection.query("INSERT INTO itunes_urlq set ? ", data, function(err,rows) {
								console.log('Inserting url' + matches[i]);
								if (err) throw err;
								console.log("Successfully inserted into itunes_urlq record with id of " + rows.insertId);
							});
						}						
				} else {//if the response is not empty...
					console.log('Empty Response');
				}								
			} else {
				//console.log('error: '+ response.statusCode)
				console.log("ERROR");
	        	console.log(error)
			}

			//delete this URL from the queue
			connection.query("DELETE FROM itunes_urlq WHERE url = ? ", url, function(err,rows) {
				console.log('Deleted url ' + url);
				if (err) throw err;

				console.log('Successfully deleted url' + url);
			});
	});	
}

function parseMovie(movieResults) {
	var prices = new Array();
	var offers = movieResults['offers'];
		
	var movie_year = 0;
	if (movieResults['releaseDate'] !== null) {							
		movie_year = movieResults['releaseDate'].date("YYYY");
	}	

	var movie_name = movieResults['name'];
	movie_name = normalizeMovieTitle(movie_name);

	var query = connection.query('SELECT movie.id, movie.title, movie.year, moviesource.id as moviesourceid FROM movie LEFT JOIN moviesource ON movie.id = moviesource.movie_id AND moviesource.source = \'itunes\' WHERE (movie.title = ? OR movie.alt_title = ?) ORDER BY movie.year DESC;', [movie_name, movie_name], function (err,rows, fields) {
		if (err) throw err;
		var movierow;
		if (rows.length == 1) {
			movierow = rows[0];
		} else if (rows.length > 1) { //see if there is more than one...
			if (movie_year > 0) {
				//loop through each movie that matched this title
				for(var i = 0;i<rows.length;i++) {
					//check the release year of it against the release date year of the record we have 
					if (rows[i].year == movie_year) {
						movierow = rows[i];
					}
				}
			} //otherwise, we're going with the first guy
		} 
		if (movierow) {
			//console.log('Found a movie');
			//it does, then check to see if there is an iTunes record for it
			if (movierow.moviesourceid > 0) {
				//there is, then update it (specifically the moviesource info)
				//Update the moviesource info				
				updateMovieSource(movieResults, movierow.id, movierow.moviesourceid);
			} else {
				console.log('there is not, then create the iTunes moviesource record for this movie');
				updateMovieSource(movieResults, movierow.id, 0);
			}
		} else {
			//console.log('create the movie');
			var contentRating = 0;
			if (movieResults['contentRating'].name == 'G') {
				contentRating = 1;
			} else if (movieResults['contentRating'].name == 'PG') {
				contentRating = 2;
			} else if (movieResults['contentRating'].name == 'PG-13') {
				contentRating = 3;
			} else if (movieResults['contentRating'].name == 'R') {
				contentRating = 4;
			} else if (movieResults['contentRating'].name == 'NC-17') {
				contentRating = 5;
			}

			var moviedata = {
				title : movie_name,
				alt_title : '',
				year : movie_year,
				mpaa : contentRating,				//[0=NR,1=G,2=PG,3=PG-13,4=R,5=NC-17]
				description : '',
				genre_primary : '',
				director_id : 0,
				duration : '',			//	[120]
				studio : '',
				budget : '',
				release_date : movieResults['releaseDate'],
				box_office : ''
			};
			//console.log(moviedata);										
			//it doesn't? then create the movie record
			var query = connection.query('INSERT INTO movie set ? ', moviedata, function(err,result,fields) {				
				//create the moviesource record as well...				
				updateMovieSource(movieResults, result.insertId, 0);				
			});			
		}
	
	});
}

function updateMovieSource(movieResults, movie_id, moviesource_id) {
	//there isn't, then create the iTunes moviesource record for this movie
	var rental_price = 0;
	var purchase_price = 0;
	var rental_price_hd = 0;
	var purchase_price_hd = 0;
	var coming_soon = 0;
	for (var i = 0;i<movieResults['offers'].length;i++) {
		if (movieResults['offers'][i].requiresHdcp) {
			//hd
			if (movieResults['offers'][i]['actionText'].short == 'Buy') {
				purchase_price_hd = movieResults['offers'][i].price;
			} else if (movieResults['offers'][i]['actionText'].short == 'Rent') {
				rental_price_hd = movieResults['offers'][i].price;
			} else if (movieResults['offers'][i]['actionText'].short == 'Pre-Order') {
				purchase_price_hd = movieResults['offers'][i].price;
				coming_soon = 1;
			}
		} else {
			//non-HD
			if (movieResults['offers'][i]['actionText'].short == 'Buy') {
				purchase_price = movieResults['offers'][i].price;
			} else if (movieResults['offers'][i]['actionText'].short == 'Rent') {
				rental_price = movieResults['offers'][i].price;
			} else if (movieResults['offers'][i]['actionText'].short == 'Pre-Order') {
				purchase_price = movieResults['offers'][i].price;
				coming_soon = 1;
			}
		}
	}

	
	var data = {
		movie_id : movie_id,
		source : 'itunes',
		source_id : movieResults['id'],
		free : 0,//				[1/0]	--denotes if it is truly free
		subscription_free : 0, // 	[1/0]	--denotes free with subscription (i.e. hulu + or Netflix)
		rental_price : rental_price,
		purchase_price : purchase_price,
		rental_price_hd : rental_price_hd,
		purchase_price_hd : purchase_price_hd,
		cc : 0,
		coming_soon: coming_soon
	};
	if (moviesource_id > 0) {
		connection.query('UPDATE moviesource set ? WHERE id = ?', [data,moviesource_id], function(err, rows, fields) {
//			console.log("Successfully updated moviesource record with id of " + moviesource_id);
		});	
	} else {
		connection.query('INSERT INTO moviesource set ? ', data, function(err, rows, fields) {
//			console.log("Successfully created moviesource record with id of " + rows.insertId);
		});	
	}
}

//normalize the movie title (removing additional things like "(2015) or (Watch Now)"")	
function normalizeMovieTitle(movietitle) {
	var thereturn = movietitle;
	thereturn = thereturn.trim();
			
	//if it ends on a right ) and the corresponding left ( doesn't start the string, then cut it from the string
		if (thereturn[thereturn.length - 1] == ')') {
			for(var i = (thereturn.length - 1);i>=0;i--) {
				if (thereturn[i] == '(') {
					if (i != 0) {
						thereturn = thereturn.substr(0, i-1);
						thereturn = thereturn.trim();
					}
					break;
				}
			}
		}

	// if there is a hyphen - directly to the left of the ( then cut that too
	if (thereturn[thereturn.length - 1] == '-') {
		thereturn = thereturn.substr(0, thereturn.length - 2);
		thereturn = thereturn.trim();
	}

	//if there is 'Anniversary' to the right of the - then cut everything to the right of the hyphen -
	var holdsplit = thereturn.split('-');	
	var match = holdsplit[0].match(/anniversary/gi);
	if (match !== null) {
		thereturn = holdsplit[0];
	}


	return thereturn;
}


connection.connect();

var url_queue = new Array(); // 
var queryString = 'SELECT DISTINCT url FROM itunes_urlq ORDER BY url'; //load pre-existing url q list from DB 
connection.query(queryString, function(err, rows, fields) {
    if (err) throw err;
 
 	if (rows.length > 0) { 	
    	for (var i in rows) {
    		url_queue.push(rows[i].url);	        
	    }
	} else {
		//if empty, start with INITIAL_URL
		url_queue.push(INITIAL_URL);		
	}

	for(var i = 0;i<url_queue.length;i++) {	
		parseiTunesURL(url_queue[i]);		
	}
});
		
 
//console.log('closing connection');
//connection.end();
