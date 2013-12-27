module.exports = [
	{
		name: 'user_1',
		associates: [],
		location: {
			city: 'Copenhagen',
			address: 'Wildersgade'
		}
	},
	{
		name: 'user_2',
		associates: ['user_1', 'user_3'],
		location: {
			city: 'Aarhus',
			address: 'Niels Borhs Vej'
		}
	},
	{
		name: 'user_3',
		associates: ['user_2'],
		location: {
			city: 'Aarhus',
			address: 'Hovedgade'
		}
	}
];
