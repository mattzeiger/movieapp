var express = require('express');
var router = express.Router();


router.all('/', function(req, res, next) {	
	if (req.method == "POST") {
		//delete checked customers
		var input = JSON.parse(JSON.stringify(req.body));
		
		if (input.actions == 'delete') {
			if (input['checkboxid[]'].length > 0) {
				if (input['checkboxid[]'].length > 1) {
					input['checkboxid[]'] = input['checkboxid[]'].join(',');
				}
				console.log("deleting customers..." + input['checkboxid[]'] );
				
				req.getConnection(function(err,connection) {
					var query = connection.query('DELETE FROM customer WHERE id IN (' + input['checkboxid[]'] + ')', function(err,rows) {
						if(err) {
			                console.log("Error Deleting : %s . ",err );
						}
						
						console.log('Successfully deleted ' + input['checkboxid[]']);
						
						res.redirect("/customers?status=deleted");
					});
				});
			}
		}		
	}
	req.getConnection(function(err,connection){
		var query = connection.query('SELECT * FROM customer',function(err,rows) {			
	            if(err) {
	                console.log("Error Selecting : %s ",err );
				}
			
				if(req.query.format == "json") {
					res.json(rows);
				} else {
	            	res.render('customers',{page_title:"Customers - Node.js",data:rows, status:req.query.status});
				}
	         });
	    });	

});


router.all('/edit/:id', function(req, res, next) {
	req.userid = req.params.id;
	next();
});
router.all(/^\/(add|edit)/, function(req, res, next) {	
	console.log("req.userid:" + req.userid);
	if (req.method == "POST") {				
		var input = JSON.parse(JSON.stringify(req.body));
		
		if (input.inputName) { //validate input						
			var data = {
				name: input.inputName,
				address: input.inputAddress,
				email: input.inputEmail,
				phone: input.inputPhone
			};
			
			if (input.inputID > 0) {
				//its an update
				console.log("Updating customer");
				
				req.getConnection(function(err,connection){
					var query = connection.query('UPDATE customer set ? WHERE id = ?', [data,input.inputID], function(err,rows) {
						if (err) { console.log("Error Selecting : %s ", err); }
						res.redirect("/customers?status=updated");												
					});
				});
				
			} else {			
				//create a new customer record
				console.log("Creating a new customer");
												
				req.getConnection(function(err,connection){			
					
					var query = connection.query('INSERT INTO customer set ?', data, function(err,rows) {
						
						if (err) {
							console.log("Error Selecting : %s ",err );
						}
						
						res.redirect("/customers?status=created");												
					});
				});		
			}
		}
	} else {
		console.log('here a');
		if (req.userid > 0) {
			console.log('here b');
			//load up the user info
			req.getConnection(function(err,connection) {
				
				var query = connection.query("SELECT * FROM customer where id = ?", req.userid, function(err,rows) {
					if (err) {
						console.log("Error locating user " + req.userid + " : %s", err);
					}
					var customer = {
						id : rows[0].id,
						name : rows[0].name,
						address : rows[0].address,
						email : rows[0].email,
						phone : rows[0].phone
					};
					res.render('customers_edit', {customer:customer});
				});
			});
		} else {
			console.log('here c');
			res.render('customers_edit');
		}
	}
	
});



module.exports = router;