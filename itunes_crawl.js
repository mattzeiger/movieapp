var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');

var app = express();
var connection = require('express-myconnection');
var mysql = require('mysql');
var request = require('request').defaults({
		maxRedirects:20,
		jar: true
	});


app.set('port', process.env.PORT || 8080);

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use(
	connection(mysql, {
		host: 'localhost',
		user: 'root',
		password: 'root',
		port: 3306,
		database: 'movieapp'
	}, 'pool')
);

app.use('/', routes);

/* 

//module.exports = app;
//start server
app.listen(app.get('port'), function() {
	console.log("App is listening on port " + app.get('port'));
});
*/

	//'X-Apple-Store-Front: 143441-1,28'
	//https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewGrouping?cc=us&id=39
	var options = {
		urL : 'file://localhost/Applications/MAMP/htdocs/movieapp/itunes/response.json',
		headers: {
			'X-Apple-Store-Front' : '143441-1,28'
		}
	};
	request('file://localhost/Applications/MAMP/htdocs/movieapp/itunes/response.json', function(error, response, body) {
		console.log("CHECK A");
		if (!error) {
			console.log("NO ERROR"); // && response.statusCode == 200
			var holdar = body.split('its.serverData=');
			var new_response = holdar[1];
			hold_ar = new_response.split("</script>");
			var json_raw_response = hold_ar[0];

			var json_response = JSON.parse(json_raw_response);			
			console.log(json_raw_response);
			console.log(json_response['storePlatformData']['lockup-room']['version']); //['results']
			console.log("HERE A");

			/*
			// cheerio parses the raw HTML of the response into a jQuery-like object for easy parsing
			var $ = cheerio.load(body);

			// we're specifically looking for an ID on the page we need to log in, which looks like this: 
			// <input type="hidden" name="authURL" value="1388775312720.+vRSN6us+IhZ1qOSlo8CyAS/ZJ4=">
			data.authURL = $("input[name='authURL']").attr("value");

			request.post("https://signup.netflix.com/Login", { form: data }, function(err, resp, body) {
				if (err) { throw err; }
				console.log("Successfully logged in.");

				// when you first log in, NF prompts you to use the default profile or create a new one
				// this function gets us through that interstitial page
				getProfileCookie(function() {
					for (var c = 0; c < 100000; c += 1) {
						getGenre(c);
					}
				});
			});
			
			$holdar = explode('its.serverData=', $response);
			$new_response = $holdar[1];
			$hold_ar = explode("</script>", $new_response);
			$json_raw_response = $hold_ar[0];

			$json_response = json_decode($json_raw_response);
			if ($json_response == NULL) {
				echo "Not Decoded!";
				exit();
			}

			$movie_results = $json_response->{'storePlatformData'}->{'lockup-room'}->{'results'};
			foreach ($movie_results as $key=>$value) {
				$prices = array();
				$offers = $movie_results->{$key}->{'offers'};
				echo $movie_results->{$key}->{'name'}." - ";//." | ".implode(" | ", $prices)."\r\n";

				foreach ($offers as $akey=>$avalue) {
					$prices[$avalue->{'actionText'}->{'short'}] = $avalue->{'priceFormatted'};	
					echo $avalue->{'actionText'}->{'short'}." : ".$avalue->{'priceFormatted'}." | ";
				}
				echo "\r\n";
				
			}
			*/
		} else {
			//console.log('error: '+ response.statusCode)
        	console.log(body)
		}
	});


