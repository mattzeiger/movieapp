//why is movie & moviesource getting out of sync?

var mysql = require('mysql');
var request = require('request');
var unique = require('array-unique'); //used to unique an array //unique(['a', 'b', 'c', 'c']);
var dateformatl = require('date-format-lite');

//var INITIAL_URL = 'http://localhost:8080/response.html'; //https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewGrouping?cc=us&id=39'; //Movies Page on iTunes
var INITIAL_URL = 'https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewGrouping?cc=us&id=39'; 
//var INITIAL_URL = 'https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewMultiRoom?cc=us&fcId=678343783';
var connection = mysql.createConnection(
    {
      host     : 'localhost',
      user     : 'root',
      password : 'root',
      database : 'movieapp',
    }
);


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
					clearURL(url, function() {
						return callback();
					}); 
				}

				function isDoneParsing() {					
					if (!queuing_movies && movies_parsing == 0) { //if we're done queuing and parsing movies
						if (hasmovies) { //if this URL has movies, add the URL's from the page (this should help keep from crawling all of the non-movie pages)							
							//dont look for URL's on the page to q up until the parsing is done....
							findURLs(new_response, function() {
								clearURL(url, function() {
									return callback();
								}); 
							});							
						} else {
							console.log("No Movie Results");
							clearURL(url, function() {
								return callback();
							}); 
						}
					}		
				}		
			} else {//if the response is not empty...
				console.log('Empty Response');
				clearURL(url, function() {
					return callback();
				});    
			}								
		} else {				
			console.log("HTTP ERROR" + error);
			clearURL(url, function() {
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
function clearURL(url, callback) {
	//delete this URL from the queue
	var now = new Date();
	connection.query("UPDATE itunes_urlq SET dateparsed = ? WHERE url = ? ", [now.format("YYYY-MM-DD hh:mm"), url], function(err,rows) {				
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
	var isEdition = detectEdition(movie_name); //blank if not, otherwise the descriptors comma-separated
	
	//normalize the title
	var alt_title = movie_name;	
	movie_name = normalizeMovieTitle(movie_name);
	if (alt_title == movie_name) {
		alt_title = '';
	}

	//first, attempt to find the movie_id based on movieResults['id'] (the iTunes unique key)
	var query = connection.query('SELECT movie.id, movie.title, movie.year, movie.edition_label, movie.parent_id, moviesource.id as moviesourceid FROM movie LEFT JOIN moviesource ON movie.id = moviesource.movie_id AND moviesource.source = \'itunes\' WHERE moviesource.source_id = ? ', movieResults['id'], function (err,rows,fields) {
		if (err) throw err;		
		if (rows.length > 0) { //we found the movie, based on the iTunes key!
			var movierow;
			movierow = rows[0];

			//go ahead and correct the title and the edition fields if its an edition
			if (isEdition != '') {
				//Look for the Parent: see if this title and approximate year match another movie (i.e. attempt to find the parent movie for this edition)
				var query = connection.query("SELECT id FROM movie WHERE (movie.title = ? OR movie.alt_title = ?) AND (movie.year >= (?-1) AND movie.year <= (?+1)) AND parent_id=0 AND (edition_label = '' OR edition_label IS NULL) AND movie.id <> ? ", [movie_name, movie_name, movierow.year, movierow.year, movierow.id], function (err,rows) {
					if (err) throw err;		
					var parent_id = movierow.parent_id;
					if (rows.length > 0 && parent_id == 0) {
						parent_id = rows[0].id;						
					}

					var query = connection.query('UPDATE movie SET movie.title = ?, alt_title = ?, movie.edition_label = ?, parent_id = ? WHERE id = ?', [movie_name, alt_title, isEdition, parent_id, movierow.id], function (err,rows) {
						if (err) throw err;		
						//updated the title and edition					

					});

				});			
			}
			//Update the moviesource info				
			updateMovieSource(movieResults, movierow.id, movierow.moviesourceid, callback);
		} else {
			//if this fails, then 
			//locate based on title or alt_title and approximate year
			var query = connection.query('SELECT movie.id, movie.title, movie.year, movie.mpaa, movie.edition_label, movie.parent_id, moviesource.id as moviesourceid FROM movie LEFT JOIN moviesource ON movie.id = moviesource.movie_id AND moviesource.source = \'itunes\' WHERE (movie.title = ? OR movie.alt_title = ?) AND (movie.year >= (?-1) AND movie.year <= (?+1)) ORDER BY movie.release_date ASC;', [movie_name, movie_name, movie_year, movie_year], function (err,rows, fields) {				
				var parent_id = 0;
				if (rows.length == 1) {
					movierow = rows[0];
				} else if (rows.length > 1) { //see if there is more than one...
					//see if our movie record is an edition
					if (isEdition != '') {
						//it is! then a few possibilities...
						var matched = false;
						var potential_parent = new Array();
						//a) we've already imported this edition, and need to try to match it to the one we've imported before
						//loop through the movies
						for (var i = 0;i<rows.length;i++) {
							//see if isEdition = edition_label
							if (isEdition == rows[i].edition_label) {									
								//it is, then movierow = rows[i];
								movierow = rows[i];
								matched = true;
							} else {
								if (rows[i].parent_id == 0) {
									potential_parent.push(i);
								}
							}			
						}
						//end loop

						if (!matched) {
							//b) we've never imported this edition, but we should go ahead and try to match it up against an original theatrical release
							//find the movies that parent_id = 0, and preferably mpaa != 0
							if (potential_parent.length > 0) {
								parent_id = rows[potential_parent[0]].id; //match it up to the first one by default
								for (var i = 0;i<potential_parent.length;i++) {
									if (rows[potential_parent[i]].mpaa == 0) {
										parent_id = rows[potential_parent[i]].id;
										break;
									}
								}								
							}								
						}
					} else {
						//its not an edition, and so let's just go with the first one (oldest release date)
						movierow = rows[0];						
					}
				} 
				if (movierow) {
					//console.log('Found a movie');
					//it does, then check to see if there is an iTunes record for it
					if (movierow.moviesourceid > 0) {
						//there is, then update it (specifically the moviesource info)
						//Update the moviesource info				
						updateMovieSource(movieResults, movierow.id, movierow.moviesourceid, callback);
					} else {
						//console.log('there is not, then create the iTunes moviesource record for this movie');
						updateMovieSource(movieResults, movierow.id, 0, callback);
					}
				} else {
					//console.log('Create the movie');
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
						alt_title : alt_title,
						year : movie_year,
						mpaa : contentRating,				//[0=NR,1=G,2=PG,3=PG-13,4=R,5=NC-17]
						description : '',
						genre_primary : '',
						director_id : 0,
						duration : '',			//	[120]
						studio : '',
						budget : '',
						release_date : movieResults['releaseDate'],
						box_office : '',
						edition_label: isEdition,
						parent_id : parent_id
					};
					//console.log(moviedata);										
					//it doesn't? then create the movie record
					var query = connection.query('INSERT INTO movie set ? ', moviedata, function(err,result,fields) {				
						//create the moviesource record as well...				
						updateMovieSource(movieResults, result.insertId, 0, callback);				
					});			
				}
			
			});

		}
	});			
	//console.log(query.sql);
}

function updateMovieSource(movieResults, movie_id, moviesource_id, callback) {
	//there isn't, then create the iTunes moviesource record for this movie
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

	//@@@make sure this movieResults['id'] isn't already in moviesource table...	
	var query = connection.query("SELECT id, movie_id, source_id FROM moviesource WHERE source = 'itunes' AND source_id = ? ORDER BY movie_id DESC ", movieResults['id'], function(err, rows) {
		//it is there, then 
		if (rows.length > 0) {
			//lets go ahead and make sure this movie_id matches the one we found
			if (rows[0].movie_id != movie_id) {
				//it doesnt! uh oh... we have a duplicate movie, our current movie_id and the movie_id we found are duplicates since there are two movie_ids that have the same itunes source_id....
				//lets delete the higher movie_id, since thats a newer one, also only if active = 0, since we dont want to mess up live data
				var deleting_id = rows[0].movie_id;
				if (movie_id > deleting_id) {
					deleting_id = movie_id;
					movie_id = rows[0].movie_id; //change the reference of this moviesource we have found to be the right movie
				}
				var query = connection.query("DELETE FROM movie WHERE id = ? AND active = 0 LIMIT 1;", deleting_id, function(err,rows) {
					//deleting a duplicate movie 

				});					
			}
			//if (moviesource_id == 0) { //no matter which one we were trying to udpate, we're forcing it to be the first one...
				moviesource_id = rows[0].id; //we are now updating this moviesource, since there's one with this itunes source id already
			//}
			if (rows.length > 1) { //delete the other moviesources
				for(var i = 1;i<rows.length;i++) {
					var query = connection.query("DELETE FROM moviesource WHERE id = ?", rows[i].id, function(err, rows) {
						//deleted the duplicate moviesources!
					});
				}
			}
		}
		var now = new Date();
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
			data.dateupdated = now.format("YYYY-MM-DD hh:mm");
			connection.query('UPDATE moviesource set ? WHERE id = ?', [data,moviesource_id], function(err, rows, fields) {
				return callback();
			});	
		} else {		
			data.dateadded = now.format("YYYY-MM-DD hh:mm");
			connection.query('INSERT INTO moviesource set ? ', data, function(err, rows, fields) {
				return callback();
			});	
		}
	});	
}

//An edition is a version of an original film (e.g. Director's Cut, etc.).
//Keywords to match an edition: Director, Unrated, Extended within a () or []
function detectEdition(movietitle) {
	movietitle = strip3D(stripYears(movietitle.trim()));
	var match = movietitle.match(/(\s*(\(|\[).*(director|unrated|extended|edition).*?(\)|\])|\s*(\[)(dubbed|subtitled)(\]))/gi);
	if (match !== null) {
		var holdstr = '';
		for(var j = 0;j<match.length;j++) {
			holdstr += match[j].trim() + ',';
		}
		return holdstr.substr(0, holdstr.length - 1);
	} else {
		return '';
	}
}

//normalize the movie title (removing additional things like "(2015) or (Watch Now)"")	
function normalizeMovieTitle(movietitle) {
	var thereturn = movietitle;
	thereturn = thereturn.trim();
	thereturn = strip3D(stripYears(thereturn));

	thereturn = thereturn.replace(/(\s*(\(|\[).*(director|unrated|extended|edition).*?(\)|\])|\s*(\[)(dubbed|subtitled)(\]))/gi, '');

	//if it ends on a right ) and the corresponding left ( doesn't start the string, then cut it from the string
	if ((thereturn[thereturn.length - 1] == ')') || (thereturn[thereturn.length - 1] == ']')) {
		for(var i = (thereturn.length - 1);i>=0;i--) {
			if ((thereturn[i] == '(') || (thereturn[i] == '[')) {
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
function stripYears(somestr) {	
	return somestr.replace(/\s*(\(|\[)(\d{4})(\)|\])/, '').trim();
}
function strip3D(somestr) {
	return somestr.replace(/\s*(\(|\[)(\d{1})D(\)|\])/, '').trim();
}



connection.connect();	

var now = new Date();
connection.query("SELECT url FROM itunes_urlq WHERE (dateparsed < ? OR dateparsed IS NULL) ORDER by rand() ", now.format("YYYY-MM-DD"), function(err, rows, fields) {
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
