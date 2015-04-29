<?php

function curlPOST($url, $data, $cookie) {
	$thereturn = '';
	

	//Start CURL session	
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, $url);
//	curl_setopt($ch, CURLOPT_POST, 1);

//	curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
	curl_setopt($ch, CURLOPT_VERBOSE, 1);
	curl_setopt($ch, CURLOPT_TIMEOUT, 120);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

	//curl_setopt($ch, CURLOPT_COOKIE, $cookie);

//	curl_setopt($ch, CURLOPT_HTTPHEADER, array("Content-type: application/json"));
	//curl_setopt($ch,CURLOPT_USERAGENT,'iTunes/12.1 (Macintosh; OS X 10.10.1) AppleWebKit/0600.1.25');
	//'X-Apple-Tz: -28800',
	curl_setopt($ch, CURLOPT_HTTPHEADER, array(	    
	    'X-Apple-Store-Front: 143441-1,28'
	    ));
	
	
	$buffer = curl_exec($ch);
	curl_close($ch);

	return $buffer;
}

//s_vi=[CS]v1|2A687D7785012C15-4000010B40146812[CE]; ns-mzf-inst=35-160-80-118-3-8166-202299-20-nk11; xp_ci=3z2lXbDGzAKz4tlzAkRzFNGQquMI; itspod=20; Pod=20; 
//dssid2=da908f2a-3fb9-481c-a055-cefcba19c1e3;  dssf=1;
//X-JS-SP-TOKEN=5zjE7IAPPgMWtGooGbZFAA==; X-JS-TIMESTAMP=1422915756; dssf=1; dssid2=da908f2a-3fb9-481c-a055-cefcba19c1e3; itspod=20; ns-mzf-inst=35-163-80-118-7-8172-202456-20-nk11; Pod=20; s_vi=[CS]v1|2A28C533850138EA-60000132E000629C[CE]; xp_ci=3z1MRbcPzL9z5HNzALuz1HGLM4JvK
//$hold_cookie = "ns-mzf-inst=35-163-80-118-7-8172-202456-20-nk11; s_vi=[CS]v1|2A28C533850138EA-60000132E000629C[CE]; xp_ci=3z1MRbcPzL9z5HNzALuz1HGLM4JvK; itspod=20; Pod=20;";

//"https://itunes.apple.com/us/genre/movies-action-adventure/id4401" <= web-based sitemap, good for identifying movies available on iTunes
//https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewGrouping?cc=us&id=39 <= Movies page within iTunes itself.

$response = curlPOST("https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewGrouping?cc=us&id=39", "", "");

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
echo "END";
?>