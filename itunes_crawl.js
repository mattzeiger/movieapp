var mysql = require('mysql');
var request = require('request');
var unique = require('array-unique'); //used to unique an array //unique(['a', 'b', 'c', 'c']);
var dateformatl = require("date-format-lite");

var INITIAL_URL = 'http://localhost:8080/response.html'; //https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewGrouping?cc=us&id=39'; //Movies Page on iTunes
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
					var movie_results = json_response['storePlatformData']['lockup-room']['results'];
					for (var key in movie_results) {

						parseMovie(movie_results[key]);

										
					} //end for loop				

					//look for other Pages (i.e. URL's with MZStore.woa
						//add them to url_queue

				} //if the response is not empty...

			} else {
				//console.log('error: '+ response.statusCode)
				console.log("ERROR");
	        	console.log(error)
			}
	});	
}

function parseMovie(movieResults) {
	var prices = new Array();
	var offers = movieResults['offers'];
	
	//console.log(movie_results[key]['name']);					
	//see if a movie exists with this name, alt_name and this year

	//console.log('releaseDate:' + movie_results[key]['releaseDate']);
	if (movieResults['releaseDate'] == null) {							
		var movie_year = 0;
		//var now = new Date();
		//now.format("YYYY");
		//console.log("Release date null for " + movie_results[key]['name'] + ' so we are setting it to :' + movie_year);	
	} else {
		var movie_year = movieResults['releaseDate'].date("YYYY");
	}

	/*
	echo $movie_results->{$key}->{'name'}." - ";//." | ".implode(" | ", $prices)."\r\n";

			foreach ($offers as $akey=>$avalue) {
				$prices[$avalue->{'actionText'}->{'short'}] = $avalue->{'priceFormatted'};	
				echo $avalue->{'actionText'}->{'short'}." : ".$avalue->{'priceFormatted'}." | ";
			}
			echo "\r\n";
	*/

	var movie_name = movieResults['name'];
	//normalize the movie title (removing additional things like "(2015) or (Watch Now)"")	
	
//if it ends on a right ) and the corresponding left ( doesn't start the string, then cut it from the string
	// if there is a hyphen - directly to the left of the ( then cut that too
//if there is 'Anniversary' to the right of the - then cut everything to the right of the hyphen -


	var query = connection.query('SELECT movie.id, movie.title, movie.year, moviesource.id as moviesourceid FROM movie LEFT JOIN moviesource ON movie.id = moviesource.movie_id AND moviesource.source = \'itunes\' WHERE (movie.title = ? OR movie.alt_title = ?) ORDER BY movie.year DESC;', [movie_name, movie_name], function (err,rows, fields) {
		if (err) throw err;
		//see if there is more than one...				
		if (rows.length > 1) {
			if (movie_year > 0) {
				//loop through each movie that matched this title
					//check the release year of it against the release date year of the record we have 
			} else {
				//we're going with the first guy
			}
		} else if (rows.length == 1) {
			//it does, then check to see if there is an iTunes record for it
			if (rows[0].moviesourceid > 0) {
				//there is, then update it
			} else {

				//there isn't, then create the iTunes moviesource record for this movie
				/*
				var data = {
					movie_id : rows[0].id,
					source : 'itunes',
					source_id : '',
					free : ''				[1/0]	--denotes if it is truly free
					subscription_free 	[1/0]	--denotes free with subscription (i.e. hulu + or Netflix)
					rental_price		[2.99]
					purchase_price		[9.99]
					rental_price_hd		[2.99]
					purchase_price_hd	[9.99]
					cc					[1/0]
					coming_soon			[1/0]
				};
				connection.query('INSERT INTO moviesource set ? ', data, function(err, rows, fields) {

				});
				*/


			}
		} else if (rows.length == 0) {

			var moviedata = {
				title : '',
				alt_title : '',
				year : '',
				mpaa : '',				//[0=NR,1=G,2=PG,3=PG-13,4=R,5=NC-17]
				description : '',
				genre_primary : '',
				director_id : '',
				duration : '',			//	[120]
				studio : '',
				budget : '',
				release_date : '',
				box_office : ''
			};										
			//it doesn't? then create the movie record
			var query = connection.query('INSERT INTO movie set ? ', moviedata, function(err,rows,fields) {

			});			
		}
	
	});
}


connection.connect();

var url_queue = new Array(); // 
var queryString = 'SELECT * FROM itunes_urlq'; //load pre-existing url q list from DB 
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
