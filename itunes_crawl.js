var mysql = require('mysql');
var request = require('request');
var unique = require('array-unique'); //used to unique an array //unique(['a', 'b', 'c', 'c']);

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
						var prices = new Array();
						var offers = movie_results[key]['offers'];
						
							//console.log(movie_results[key]['name']);					
						//see if a movie exists with this name, alt_name and this year
						var movie_name = movie_results[key]['name'];
						var movie_year = {movie_results[key]['releaseDate'].split('-')}[0];
						console.log('movie_year:' + movie_year);
						connection.query('SELECT * FROM movie WHERE (title = ? OR alt_title = ?) AND year = ?;', {movie_name, movie_name, movie_year}, function (err,rows, fields) {


							//it does, then check to see if there is an iTunes record for it
								//there is, then update it
								//there isn't, then create it
								
							//it doesn't? then create it	

							/*echo $movie_results->{$key}->{'name'}." - ";//." | ".implode(" | ", $prices)."\r\n";

							foreach ($offers as $akey=>$avalue) {
								$prices[$avalue->{'actionText'}->{'short'}] = $avalue->{'priceFormatted'};	
								echo $avalue->{'actionText'}->{'short'}." : ".$avalue->{'priceFormatted'}." | ";
							}
							echo "\r\n";

							var moviedata = {
								name: input.inputName,
								address: input.inputAddress,
								email: input.inputEmail,
								phone: input.inputPhone
							};
							
							
							//create a new movie record
							console.log("Creating a new movie");						
															
							req.getConnection(function(err,connection){			
								
								var query = connection.query('INSERT INTO customer set ?', data, function(err,rows) {
									
									if (err) {
										console.log("Error Selecting : %s ",err );
									}
									
									res.redirect("/customers?status=created");												
								});
							});		
						});

						

						*/
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
});
		

for(var i = 0;i<url_queue.length;i++) {
	parseiTunesURL(url_queue[i]);
}
 
connection.end();
