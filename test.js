var moviedata = require('moviedata');

function detectEdition(movietitle) {
	movietitle = strip3D(stripYears(movietitle.trim()));
	var match = movietitle.match(/(\s*(\(|\[).*(director|unrated|extended).*?(\)|\])|\s*(\[)(dubbed|subtitled)(\]))/gi);
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

	thereturn = thereturn.replace(/(\s*(\(|\[).*(director|unrated|extended).*?(\)|\])|\s*(\[)(dubbed|subtitled)(\]))/gi, '');

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



var movie_name = 'The Italian (L\'Italien) [The Italian]';

var movie_name = moviedata.normalizeMovieTitle(movie_name);

/*
//var movie_name = 'Quai des Orfèvres (Jenny Lamour) [Subtitled]';
//Robin Hood (Unrated Director's Cut) [2010] [Unrated Director's Cut]
//Robin Hood (Unrated Director's Cut) [2010] [Unrated Director's Cut]
//The Hunchback of Notre Dame (Silent) [1923]

//see if this is a director's cut, extended edition, or anniversary edition
var isEdition = detectEdition(movie_name); //blank if not, otherwise the descriptors comma-separated

//normalize the title
var alt_title = movie_name;
movie_name = normalizeMovieTitle(movie_name);
if (alt_title == movie_name) {
	alt_title = '';
}
*/
console.log(movie_name);
//console.log(alt_title);
//console.log(isEdition);
