/*
Advance Tactics
1. Using viruses to trap players
2. Shoot at viruses to break large blobs

//TODO Refactor action code for new possible actions
//TODO Clean up tree traversal code
//TODO Deal with gameHistory possible memory limit issue
//TODO revisit escape path
//TODO revisit "Too close for comfort"
//TODO Jump servers every 4hrs
//TODO Consider 16 piece split has the ability to eat viruses when you have more than 100 mass
//TODO High score

//TODO does feeding cell keep two from combining?

//TODO Consider lost of velocity into calculating best moves
//TODO Consider enemies about to merge
//TODO Split for escape
//TODO Consider random paths at 1200+
//TODO Feeding, Attacking, Escaping phase
//TODO Eat based on direction
//TODO Goto corner when huge
   */

function Stat(startDate,endDate,sizes,considerationWeights){
	this.startDate=startDate
	this.endDate=endDate
	this.sizes=sizes
	this.considerationWeights=considerationWeights
}
Stat.prototype={
	startDate:null,
	endDate:null,
	sizes:[],
	get maxSize(){
		return Math.max.apply(null,this.sizes);
	},
	considerationWeights:[]
}

var Organism=function(){}
Organism.prototype={
	x:0,
	y:0,
	px:0,
	py:0,
	dx:0,
	dy:0,
	dx2:0,
	dy2:0,
	dx3:0,
	dy3:0,
	size:0,
	isVirus:false
}

var Action=function(type,x,y,myOrganism,otherOrganism){
	this.type=type
	this.x=x
	this.y=y
	this.myOrganism=myOrganism
	this.otherOrganism=otherOrganism
}
Action.prototype={
	type:'', //move,split,shoot
	x:0,
	y:0,
	myOrganism:null,
	otherOrganism:null,
	weightedValues:[],
	calcImportance:function(considerations){
		var filteredConsiderations=considerations
			.filter(function(consideration){return consideration.weight&&consideration.filter(this.myOrganism,this.otherOrganism,this)},this)
		
		if(filteredConsiderations.length){
			this.weightedValues=filteredConsiderations.map(function(consideration){
				return [consideration.weightedCalc(this.myOrganism,this.otherOrganism,this),consideration]
			},this).sort(function(a,b){
				return b[0]-a[0]
			})

			return this.weightedValues[0][0]/filteredConsiderations.map(function(consideration){return consideration.weight}).reduce(function(a,b){return a+b})
		}
		return 0
	}
}

var Consideration=function(label,filter,calc,weight,color){
	this.filter=filter;
	this.weight=weight;
	this.label=label;
	this.color=color;
	this.calc=calc;
}

Consideration.prototype={
	weight:1,
	label:'',
	color:'', //TODO MD5 the label to generate a unique color
	get value(){
		return ~~this.weight;
   	},
	calc:function(myOrganism,otherOrganism,action){},
	min:0,
	max:0,
	weightedCalc:function(myOrganism,otherOrganism,action){
		var value=this.calc(myOrganism,otherOrganism,action)
		this.min=value<this.min?value:this.min
		this.max=value>this.max?value:this.max
		return (value-this.min)/(this.max-this.min)*this.weight
	},
}

var ActionGenerator=function(label,filter,calcPriority,weight,color,genAction){
	Consideration.call(this,label,filter,calcPriority,weight,color)
	this.genAction=genAction
}

ActionGenerator.prototype=Object.create(Consideration.prototype)
actionGeneratorPrototype={
	genAction:function(myOrganism,otherOrganism){}
}
for(key in actionGeneratorPrototype){
	ActionGenerator.prototype[key]=actionGeneratorPrototype[key]
}

var Ai=function(move,split,shoot){
	AiInterface.call(this,move,split,shoot)

	chrome.storage.local.get("gameHistory",function(items){
		if(items.gameHistory){
		this.gameHistory=items.gameHistory

		var weights=[],
		totalMaxSize=0
		for(var i=0;i<this.considerations.length;i++){
			weights[i]=0
		}

			for(var i=0;i<this.gameHistory.length;i++){
				var stat=this.gameHistory[i],
					totalWeight=stat.considerationWeights.reduce(function(a,b){return a+b})
				for(var j=0;j<stat.considerationWeights.length;j++){
					var maxSize=Math.max.apply(null,stat.sizes);
					if(maxSize!=0&&maxSize!=-Infinity){
						weights[j]=stat.considerationWeights[j]/totalWeight*maxSize
						totalMaxSize+=maxSize
					}
				}
			}

			this.totalWeights=weights
			this.totalMaxSize=totalMaxSize
		}
	}.bind(this))
}

Ai.prototype=Object.create(AiInterface.prototype)
//size = radius
//score=size*size/100
AiPrototype={
	splitCooldown:10000,
	depth:4,
	onDraw:function(){},
	specialNames:{},
	onTick:function(){},
	totalWeights:[],
	totalMaxSize:0,
	isTeachMode:1,
	lastActionBest5:[],
	considerations:[
		new Consideration(
			"Avoid Virus Attackers",
			function(myOrganism,otherOrganism,action){return otherOrganism.isVirus&&action.type=='move'},
			function(myOrganism,otherOrganism,action){
				return myOrganism.size-otherOrganism.size
			},
			1,
			'#FF5A5E'
		),
		new Consideration(
			"Avoid Blob w/ Slightly Larger Mass",
			function(myOrganism,otherOrganism,action){return !otherOrganism.isVirus&&myOrganism.size<otherOrganism.size&&action.type=='move'},
			function(myOrganism,otherOrganism,action){
				return -Math.abs(myOrganism.size-otherOrganism.size)
			},
			1,
			'#335A5E'
		),
		new Consideration(
			"Chase Blob w/ Slightly Smaller Mass",
			function(myOrganism,otherOrganism,action){return !otherOrganism.isVirus&&myOrganism.size>otherOrganism.size&&action.type=='move'},
			function(myOrganism,otherOrganism,action){
				return -Math.abs(myOrganism.size-otherOrganism.size)
			},
			100,
			'#AA5A5E'
		),
		new Consideration(
			"Chase Nearest Smaller Blob",
			function(myOrganism,otherOrganism,action){return !otherOrganism.isVirus&&myOrganism.size>otherOrganism.size&&action.type=='move'},
			function(myOrganism,otherOrganism,action){
				return -Math.pow(Math.pow(myOrganism.px-otherOrganism.px,2)+Math.pow(myOrganism.py-otherOrganism.py,2),.5)-myOrganism.size
			},
			150,
			'#46BFBD'
		),
		new Consideration(
			"Avoid Nearest Larger Blob",
			function(myOrganism,otherOrganism,action){
				return !otherOrganism.isVirus&&myOrganism.size<otherOrganism.size&&action.type=='move'
			},
			function(myOrganism,otherOrganism,action){ //THIS IS CORRECT DONT CHANGE
				return -Math.pow(Math.pow(otherOrganism.px-myOrganism.px,2)+Math.pow(otherOrganism.py-myOrganism.py,2),.5)+otherOrganism.size
			},
			1,
			'#46BF00'
		),
		new Consideration(
			"Avoid Colliding into Larger Blob",
			function(myOrganism,otherOrganism,action){
				return action.type=='move'
				&&!otherOrganism.isVirus
				&&myOrganism.size<otherOrganism.size
				&&Math.pow(Math.pow(myOrganism.px-otherOrganism.px,2)+Math.pow(myOrganism.py-otherOrganism.py,2),.5)<=otherOrganism.size+150},
			function(myOrganism,otherOrganism,action){
				return true;
			},
			1000,
			'#EEEEEE'
		),
		new Consideration(
			"Avoid Colliding into Virus",
			function(myOrganism,otherOrganism,action){
				return action.type=='move'
					&&otherOrganism.isVirus
					&&myOrganism.size>otherOrganism.size
					&&Math.pow(Math.pow(myOrganism.px-otherOrganism.px,2)+Math.pow(myOrganism.py-otherOrganism.py,2),.5)<=myOrganism.size+myOrganism.dx+myOrganism.dy //TODO Consider taking out pow(,.5)
			},
			function(myOrganism,otherOrganism,action){
				return true
			},
			500,
			'rgb(163,73,164)'
		) ,
		new Consideration(
			"Chase towards Middle of Map",
			function(myOrganism,otherOrganism,action){return myOrganism.size>otherOrganism.size&&!otherOrganism.isVirus&&action.type!='split'},
			function(myOrganism,otherOrganism,action){
				return -Math.pow(5600-action.x,2)-Math.pow(5600-action.y,2)
			},
			100,
			'#FDB45C'
		),
		new Consideration(
			"Avoid Splitters",
			function(myOrganism,otherOrganism,action){
				return action.type=='move'
					&&!otherOrganism.isVirus
					&& otherOrganism.size>63
					&& myOrganism.size*2<otherOrganism.size
				},
			function(myOrganism,otherOrganism,action){
				return myOrganism.size-otherOrganism.size
			},
			75,
			'#33EE33'
		),
		new Consideration(
			"Avoid Nearest Virus",
			function(myOrganism,otherOrganism,action){
				return action.type=='move'&&otherOrganism.isVirus&&myOrganism.size>otherOrganism.size
			},
			function(myOrganism,otherOrganism,action){ //THIS IS CORRECT DONT CHANGE
				return -Math.pow(Math.pow(otherOrganism.px-myOrganism.px,2)+Math.pow(otherOrganism.py-myOrganism.py,2),.5)+myOrganism.size
			},
			1,
			'#46FF22'
		),
		new Consideration(
			"Chat Movements", //10 second delay lolz
			function(myOrganism,otherOrganism,action){
				return action.type=='move'
			},
			function(myOrganism,otherOrganism,action){
				switch(action.direction){
					case 'up':
						return -action.y
					case 'down':
						return action.y
					case 'left':
						return -action.x
					case 'right':
						return action.x
					default:
						return 0;
				}
			},
			0,
			'#A0BB33'
		),
		new Consideration(
			"Split on smaller blob",
			function(myOrganism,otherOrganism,action){
				return action.type=='split'&&myOrganism.size>otherOrganism.size*2.15	
			},
			function(myOrganism,otherOrganism,action){
				return otherOrganism.size-myOrganism.size
			},
			1,
			'#AD4433'
		),
		new Consideration(
			'Split on farther blob',
			function(myOrganism,otherOrganism,action){
				return action.type=='split'&&myOrganism.size>otherOrganism.size*2.15	
			},
			function(myOrganism,otherOrganism,action){
				return Math.pow(otherOrganism.px-myOrganism.px,2)+Math.pow(otherOrganism.py-myOrganism.py,2)
			},
			1,
			'#AD4477'
		),
		new Consideration(
			"Split to escape",
			function(myOrganism,otherOrganism,action){
				return action.type=='split'
				&&!otherOrganism.isVirus
				&&otherOrganism.name!="Best route"
				&&myOrganism.size<otherOrganism.size
				&&Math.pow(Math.pow(myOrganism.px-otherOrganism.px,2)+Math.pow(myOrganism.py-otherOrganism.py,2),.5)<=otherOrganism.size+50},
			function(myOrganism,otherOrganism,action){ //Compares with dodging or just moving away
				return true
			},
			1,
			'#EEEEEE'
		),
		new Consideration(
			"Shoot to flee faster",
			function(myOrganism,otherOrganism,action){
				var dist=Math.pow(Math.pow(myOrganism.px-otherOrganism.px,2)+Math.pow(myOrganism.py-otherOrganism.py,2),.5)

				return action.type=='shoot'
				&&myOrganism.size<otherOrganism.size
				&&dist>otherOrganism.size+50
				&&dist<=otherOrganism.size+100
				},
			function(myOrganism,otherOrganism,action){ //Compares with dodging or just moving away
				return true
			},
			1,
			'#ABCD00'
		),
		new Consideration(
			"Shoot to bait",
			function(myOrganism,otherOrganism,action){
				return action.type=='shoot'
					&&myOrganism.size>otherOrganism.size
			},
			function(){
				return true
			},
			1,
			"#AFCC99"
		)
	],
	direction:'',
	actionGenerators:[
		new ActionGenerator(
			"Intercept small blob",
			function(myOrganism,otherOrganism,specialNames){
				return !otherOrganism.isVirus
					&&otherOrganism.size<myOrganism.size*.9
					&&(!specialNames[otherOrganism.name]||specialNames[otherOrganism.name]=='ignore')
			},
			function(myOrganism,otherOrganism){
				return true
			},
			1,
			'#FF0000',
			function(myOrganism,otherOrganism){
				var tickCount=Math.pow(Math.pow(myOrganism.px-otherOrganism.px,2)+Math.pow(myOrganism.py-otherOrganism.py,2),.5)/2/Math.pow(Math.pow(otherOrganism.dx,2)+Math.pow(otherOrganism.dy,2),.5)
				//tells us how long it will take to reach the midpoint
				if (tickCount == Infinity){
					tickCount=0
				}

				return new Action('move',
					myOrganism.dx+myOrganism.dx2+otherOrganism.px+otherOrganism.dx*tickCount,
					myOrganism.dy+myOrganism.dy2+otherOrganism.py+otherOrganism.dy*tickCount,
					myOrganism,
					otherOrganism)
			}
		),
		new ActionGenerator(
			"Juke big blob",
			function(myOrganism,otherOrganism){
				return !otherOrganism.isVirus&&otherOrganism.size>myOrganism.size
			},
			function(myOrganism,otherOrganism){
				return Math.pow(myOrganism.px-otherOrganism.py,2)+Math.pow(myOrganism.py-otherOrganism.py,2)
			},
			1,
			'#00FF00',
			function(myOrganism,otherOrganism){
				var tickCount=Math.pow(Math.pow(myOrganism.px-otherOrganism.px,2)+Math.pow(myOrganism.py-otherOrganism.py,2),.5)/2/Math.pow(Math.pow(otherOrganism.dx,2)+Math.pow(otherOrganism.dy,2),.5)
				//tells us how long it will take to reach the midpoint
				if (tickCount == Infinity){
					tickCount=0
				}

				return new Action('move',
					(myOrganism.px+myOrganism.dx+myOrganism.dx2)*2-otherOrganism.px-otherOrganism.dx*tickCount,
					(myOrganism.py+myOrganism.dy+myOrganism.dy2)*2-otherOrganism.py-otherOrganism.dy*tickCount,
					myOrganism,
					otherOrganism)
			}
		),
		new ActionGenerator(
			"B line away from big blob",
			function(myOrganism,otherOrganism){
				return !otherOrganism.isVirus&&otherOrganism.size>myOrganism.size
			},
			function(myOrganism,otherOrganism){
				return -Math.pow(myOrganism.x-otherOrganism.x,2)-Math.pow(myOrganism.y-otherOrganism.y,2)
			},
			1,
			'#0000FF',
			function(myOrganism,otherOrganism){
				return new Action('move',
					(myOrganism.px+myOrganism.dx+myOrganism.dx2)*2-otherOrganism.px-otherOrganism.dx-otherOrganism.dx2,
					(myOrganism.py+myOrganism.dy+myOrganism.dy2)*2-otherOrganism.py-otherOrganism.dy-otherOrganism.dy2,
					myOrganism,
					otherOrganism)
			}
		),
		new ActionGenerator(
			"B line away from virus",
			function(myOrganism,otherOrganism){
				return otherOrganism.isVirus&&otherOrganism.size<myOrganism.size
			},
			function(myOrganism,otherOrganism){
				return true
			},
			1,
			'#0000FF',
			function(myOrganism,otherOrganism){
				return new Action('move',
					(myOrganism.px+myOrganism.dx+myOrganism.dx2)*2-otherOrganism.px,
					(myOrganism.py+myOrganism.dy+myOrganism.dy2)*2-otherOrganism.py,
					myOrganism,
					otherOrganism)
			}
		),
		new ActionGenerator(
			"Split small blob",
			function(myOrganism,otherOrganism,specialNames){
				var dist=Math.pow(Math.pow(myOrganism.px-otherOrganism.px,2)+Math.pow(myOrganism.py-otherOrganism.py,2),.5)
					ftrDist=Math.pow(Math.pow(myOrganism.px+myOrganism.dx-otherOrganism.px-otherOrganism.dx,2)+Math.pow(myOrganism.py+myOrganism.dy-otherOrganism.py-otherOrganism.dy,2),.5)

				return !otherOrganism.isVirus
					&&otherOrganism.size>48
					&&otherOrganism.size*2.1<myOrganism.size
					&&(!specialNames[otherOrganism.name]||specialNames[otherOrganism.name]=='ignore')
					&&dist<ftrDist
					&&dist<550-myOrganism.size
			},
			function(myOrganism,otherOrganism){
				return true
			},
			1,
			'#FFFF00',
			function(myOrganism,otherOrganism){
				var tickCount=Math.pow(Math.pow(myOrganism.px-otherOrganism.px,2)+Math.pow(myOrganism.py-otherOrganism.py,2),.5)/2/Math.pow(Math.pow(otherOrganism.dx,2)+Math.pow(otherOrganism.dy,2),.5)
				//tells us how long it will take to reach the midpoint
				if (tickCount == Infinity){
					tickCount=0
				}

				return new Action('split',
					myOrganism.dx+myOrganism.dx2+otherOrganism.px+otherOrganism.dx*tickCount,
					myOrganism.dy+myOrganism.dy2+otherOrganism.py+otherOrganism.dy*tickCount,
					myOrganism,
					otherOrganism)
			}
		),
		new ActionGenerator(
			"Split away from big blob",
			function(myOrganism,otherOrganism){
				return !otherOrganism.isVirus
					&&myOrganism.size>64
					&&otherOrganism.size>myOrganism.size
			},
			function(myOrganism,otherOrganism){
				return true
			},
			1,
			'#0000FF',
			function(myOrganism,otherOrganism){
				return new Action('split',
					(myOrganism.px+myOrganism.dx+myOrganism.dx2)*2-otherOrganism.px-otherOrganism.dx-otherOrganism.dx2,
					(myOrganism.py+myOrganism.dy+myOrganism.dy2)*2-otherOrganism.py-otherOrganism.dy-otherOrganism.dy2,
					myOrganism,
					otherOrganism)
			}
		),
		new ActionGenerator(
			"Shoot to flee",
			function(myOrganism,otherOrganism){
				return !otherOrganism.isVirus
					&&myOrganism.size>64
					&&otherOrganism.size>myOrganism.size
			},
			function(myOrganism,otherOrganism){
				return true
			},
			1,
			'#AA00CC',
			function(myOrganism,otherOrganism){
				return new Action('shoot',
					(myOrganism.px+myOrganism.dx+myOrganism.dx2)*2-otherOrganism.px-otherOrganism.dx-otherOrganism.dx2,
					(myOrganism.py+myOrganism.dy+myOrganism.dy2)*2-otherOrganism.py-otherOrganism.dy-otherOrganism.dy2,
					myOrganism,
					otherOrganism)
			}
		),
		new ActionGenerator(
			"Shoot to bait",
			function(myOrganism,otherOrganism,specialNames){
				var dist=Math.pow(Math.pow(myOrganism.px-otherOrganism.px,2)+Math.pow(myOrganism.py-otherOrganism.py,2),.5)
					ftrDist=Math.pow(Math.pow(myOrganism.px+myOrganism.dx-otherOrganism.px-otherOrganism.dx,2)+Math.pow(myOrganism.py+myOrganism.dy-otherOrganism.py-otherOrganism.dy,2),.5)

				return !otherOrganism.isVirus
					&&otherOrganism.size>48
					&&otherOrganism.size*2.2<myOrganism.size
					&&(!specialNames[otherOrganism.name]||specialNames[otherOrganism.name]=='ignore')
					&&dist<ftrDist
					&&dist<650-myOrganism.size
					&&dist>550-myOrganism.size
			},
			function(myOrganism,otherOrganism){
				return true
			},
			1,
			'#CC12FF',
			function(myOrganism,otherOrganism){
				var tickCount=Math.pow(Math.pow(myOrganism.px-otherOrganism.px,2)+Math.pow(myOrganism.py-otherOrganism.py,2),.5)/2/Math.pow(Math.pow(otherOrganism.dx,2)+Math.pow(otherOrganism.dy,2),.5)
				//tells us how long it will take to reach the midpoint
				if (tickCount == Infinity){
					tickCount=0
				}

				return new Action('shoot',
					myOrganism.dx+myOrganism.dx2+otherOrganism.px+otherOrganism.dx*tickCount,
					myOrganism.dy+myOrganism.dy2+otherOrganism.py+otherOrganism.dy*tickCount,
					myOrganism,
					otherOrganism)
			}
		)
	],
	linesEnabled:true,
	lastAction:null,
	currentState:'',
	lastStateChangeDate:null,
	gameHistory:[],
	scoreHistory:[],
	myOrganisms:[],
	otherOrganisms:[],
	allowSplit:true,
	allowShoot:true,
	shootCooldown:5000,
	simulateAction:function(myOrganism,otherOrganisms,action){
		var tickCount=(myOrganism.dx+myOrganism.dy>0)?(Math.pow(Math.pow(action.x-myOrganism.px,2)+Math.pow(action.y-myOrganism.py,2),.5)/Math.pow(Math.pow(myOrganism.dx,2)+Math.pow(myOrganism.dy,2),.5)):0,
			clonedMyOrganism=new Organism
		
		Object.keys(Organism.prototype).forEach(function(key){clonedMyOrganism[key]=myOrganism[key]})
		clonedMyOrganism.px=action.x
		clonedMyOrganism.py=action.y

		return {
			myOrganism:clonedMyOrganism,
			otherOrganisms:otherOrganisms
				.filter(function(a){return a.id!=action.otherOrganism.id})
				.map(function(organism){
					var clone=new Organism
					Object.keys(Organism.prototype).forEach(function(key){clone[key]=organism[key]})
					clone.id=organism.id
					clone.px+=clone.dx*tickCount
					clone.py+=clone.dy*tickCount
					return clone
				})
		}
	},
	tick:function(organisms,myOrganisms,score){
		var otherOrganisms=this.otherOrganisms=organisms.filter(function(organism){
			/* velocity */
			if(!organism.x2){
				organism.x2=organism.nx
				organism.y2=organism.ny

				if(this.specialNames[organism.name]){
					this.onFoundSpecialName(organism.name)
				}
			}

			organism.dx=organism.nx-organism.x2
			organism.dy=organism.ny-organism.y2

			organism.x2=organism.nx
			organism.y2=organism.ny

			/* acceleration */
			if(!organism.pdx){
				organism.pdx=organism.dx
				organism.pdy=organism.dy
			}

			organism.dx2=organism.dx-organism.pdx
			organism.dy2=organism.dy-organism.pdy

			organism.pdx=organism.dx
			organism.pdy=organism.dy

			/* jerk */
			if(!organism.pdx2){
				organism.pdx2=organism.dx2
				organism.pdy2=organism.dy2
			}

			organism.dx3=organism.dx2-organism.pdx2
			organism.dy3=organism.dy2-organism.pdy2
			
			organism.pdx2=organism.dx2
			organism.pdy2=organism.dy2

			/* predicted coordinates for the next tick */
			organism.px=organism.nx+organism.dx+organism.dx2+organism.dx3
			organism.py=organism.ny+organism.dy+organism.dy2+organism.dy3

			return myOrganisms.indexOf(organism)==-1
		},this)

		if (myOrganisms.length){
			var myOrganism=new Organism(),
				totalSize=myOrganisms
					.map(function(myOrganism){return myOrganism.size})
					.reduce(function(a,b){return a+b})

			for(var key in Organism.prototype){
				var totalValue=myOrganisms
					.map(function(myOrganism){return myOrganism[key]*myOrganism.size})
					.reduce(function(a,b){return a+b})
				myOrganism[key]=totalValue/totalSize
			}

			var action=this.findBestAction(myOrganism,otherOrganisms,this.depth)

			if (action){
				switch(action.type){
					case 'move':
						this.move(action.x,action.y)
					break;
					case 'split':
						this.move(action.x,action.y)
						this.allowSplit=false
						setTimeout(function(){this.allowSplit=true}.bind(this),this.splitCooldown)
						this.split()
					break;
					case 'shoot':
						this.move(action.x,action.y)
						this.allowShoot=false
						setTimeout(function(){this.allowShoot=true}.bind(this),this.shootCooldown)
						this.shoot()
					break;
				}

				if(!this.lastAction
					||this.lastAction.otherOrganism.name!=action.otherOrganism.name
				){
					if(action.otherOrganism.isVirus){
						console.info("avoiding virus", action.otherOrganism.name,[action])
					}else if (action.otherOrganism.size>myOrganisms[0].size){
						console.info("avoiding", action.otherOrganism.name,[action])
					}else{
						console.info("chasing", action.otherOrganism.name,[action])
					}
				}
				this.lastAction=action
			}

			if (this.currentState!='alive'){
				this.lastStateChangeDate=new Date
			}
			this.scoreHistory.push(score)
			this.currentState='alive'
		}else{
			if(this.currentState=='alive'){
				this.gameHistory.push(new Stat(
						this.lastStateChangeDate,
						new Date,
						this.scoreHistory,
						this.considerations.map(function(consideration){return consideration.weight})))


				var slicedGameHistory=this.gameHistory.slice(this.gameHistory.length-400,this.gameHistory.length)
				chrome.storage.local.set({gameHistory:slicedGameHistory}) //TODO Learning is capped at 400 due to chrome's freezing when trying to save more than that

				var weights=this.totalWeights,
					totalMaxSize=this.totalMaxSize

				for(var i=this.gameHistory.length-1;i<this.gameHistory.length;i++){
					var stat=this.gameHistory[i],
						totalWeight=stat.considerationWeights.reduce(function(a,b){return a+b})
					for(var j=0;j<stat.considerationWeights.length;j++){
						var maxSize=Math.max.apply(null,stat.sizes);
						weights[j]=stat.considerationWeights[j]/totalWeight*maxSize
						totalMaxSize+=maxSize
					}
				}

				this.totalWeights=weights
				this.totalMaxSize=totalMaxSize

				if(!this.isTeachMode){
					for(var i=0;i<weights.length;i++){
						weights[i]/=totalMaxSize;
						weights[i]=Math.pow(weights[i],10000000);
						weights[i]+=Math.random()*100/(this.gameHistory.length%2?1:this.gameHistory.length)+1
						this.considerations[i].weight=weights[i]
					}
				}

				heatMapCtx.strokeStyle="#FF0000"
				heatMapCtx.strokeRect((this.lastAction.x-this.lastAction.myOrganism.size)/64,(this.lastAction.y-this.lastAction.myOrganism.size)/64,this.lastAction.myOrganism.size*2/64,this.lastAction.myOrganism.size*2/64)
				console.info("DEAD x_X")
				console.info("Score",~~(this.scoreHistory[this.scoreHistory.length-1]/100))
				console.info("Time spent alive",(Date.now()-this.lastStateChangeDate.getTime())/60000,"mins")
				this.scoreHistory=[]
				this.lastStateChangeDate=new Date
			}
			this.currentState='dead'
		}

		this.onTick()
	},
	genActions:function(myOrganism,otherOrganism){
		return this.actionGenerators
			.filter(function(actionGenerator){return actionGenerator.filter(myOrganism,otherOrganism,this.specialNames)},this)
			.map(function(actionGenerator){
				var action=actionGenerator.genAction(myOrganism,otherOrganism)

				//TODO Curve wall?
				if (action.x+myOrganism.size>11200){
					action.x=11200-myOrganism.size;
					action.y+=action.y-myOrganism.y
				}else if(action.x-myOrganism.size<0){
					action.x=myOrganism.size;
					action.y+=action.y-myOrganism.y
				}
				if (action.y+myOrganism.size>11200){
					action.y=11200-myOrganism.size;
					action.x+=action.x-myOrganism.x
				}else if(action.y-myOrganism.size<0){
					action.y=myOrganism.size;
					action.x+=action.x-myOrganism.x
				}

				if(this.direction){
					action.direction=this.direction
				}

				action.importance=actionGenerator.weightedCalc(myOrganism,otherOrganism)*action.calcImportance(this.considerations)
				return action
			},this)
			.filter(function(a){return (a.type!='split'||this.allowSplit)&&(a.type!='shoot'||this.allowShoot)},this)
	},
	findBestAction:function(myOrganism,otherOrganisms,depth){ 
		var actions=[]
		for(var i=0;i<otherOrganisms.length;i++){
			actions=this.genActions(myOrganism,otherOrganisms[i]).concat(actions)
		}

		if (actions.length > 1){
			var totalImportance=0,
				organism=new Organism,
				virus=new Organism,
				srcActions=[]
			for(var i=0;i<actions.length;i++){
				var action=actions[i]
				if(action.type=='move'
					&&action.otherOrganism.isVirus
					&&myOrganism.size>action.otherOrganism.size
					||!action.otherOrganism.isVirus
					&&myOrganism.size<action.otherOrganism.size
				){
					srcActions.push(action)
					totalImportance+=action.importance
					for(key in Organism.prototype){
						organism[key]+=action.otherOrganism[key]*action.importance
					}
				}
			}

			for(key in Organism.prototype){
				organism[key]/=totalImportance
			}

			for(key in Organism.prototype){
				virus[key]=organism[key]
			}
			organism.name="Best route"
			virus.name="Best anti-virus route" 
			virus.isVirus=true
			virus.dx=0
			virus.dy=0
			organism.dx=0
			organism.dy=0

			actions=actions.concat(
				this.genActions(myOrganism,organism).map(function(a){a.srcActions=srcActions; return a}),
				this.genActions(myOrganism,virus).map(function(a){a.srcActions=srcActions; return a})
			)
		}

		if(depth){
			actions.sort(function(a,b){return b.importance-a.importance})
			actions=actions.slice(0,Math.pow(actions.length,Math.pow(2,this.depth)/Math.pow(40,depth))+(this.depth==depth)).map(function(action){
				var results=this.simulateAction(myOrganism,otherOrganisms,action)
				action.next=this.findBestAction(results.myOrganism,results.otherOrganisms,depth-1)
				if(action.next){
					action.importance+=action.next.importance
				}
				return action
			},this)
		}

		actions.sort(function(a,b){return b.importance-a.importance})

		this.lastActionBest5=actions.slice(0,5)

		return actions[0]
	},
	draw:function(ctx){
		var lastAction=this.lastAction
			miniMapCtx.clearRect(0,0,175,175)

			for(var i=0;i<this.otherOrganisms.length;i++){
				var otherOrganism=this.otherOrganisms[i]
				miniMapCtx.strokeStyle="#4444FF"
				miniMapCtx.strokeRect((otherOrganism.x-otherOrganism.size)/64,(otherOrganism.y-otherOrganism.size)/64,otherOrganism.size*2/64,otherOrganism.size*2/64)
			}

		if (lastAction){
			miniMapCtx.strokeStyle="#FFFFFF"
			miniMapCtx.strokeRect((lastAction.myOrganism.x-lastAction.myOrganism.size)/64,(lastAction.myOrganism.y-lastAction.myOrganism.size)/64,lastAction.myOrganism.size*2/64,lastAction.myOrganism.size*2/64)
		}

		if(this.linesEnabled){
			while(lastAction){
					//for (var i=0;i<this.lastAction.myOrganisms.length;i++){ //TODO Only one myOrganism?
					var myOrganism=lastAction.myOrganism

					if(this.lastAction==lastAction&&(!lastAction.srcActions || !lastAction.srcActions.length)){
						ctx.beginPath()
						ctx.lineWidth=5
						if(lastAction.otherOrganism.isVirus||lastAction.otherOrganism.size>myOrganism.size){
							ctx.strokeStyle='#FF0000'
						}else{
							ctx.strokeStyle='#00FF00'
						}
						ctx.moveTo(myOrganism.px,myOrganism.py)
						ctx.lineTo(lastAction.otherOrganism.px,lastAction.otherOrganism.py)
						ctx.stroke()
					}

					ctx.lineWidth=2
					ctx.beginPath()
					ctx.strokeStyle="#FFFFFF"
					ctx.moveTo(myOrganism.px,myOrganism.py)
					ctx.lineTo(lastAction.x,lastAction.y)
					ctx.stroke()

					if(lastAction.srcActions){
						ctx.lineWidth=2
						ctx.strokeStyle='#FF0000'
						for(var i=0;i<lastAction.srcActions.length;i++){
							ctx.beginPath()
							ctx.moveTo(myOrganism.x,myOrganism.y)
							ctx.lineTo(lastAction.srcActions[i].otherOrganism.x,lastAction.srcActions[i].otherOrganism.y)
							ctx.stroke()
						}
					}
				//}
				lastAction=lastAction.next
			}
		}
		this.onDraw()
	}
}
for(key in AiPrototype){
	Ai.prototype[key]=AiPrototype[key]
}

//TODO Become sentient.







