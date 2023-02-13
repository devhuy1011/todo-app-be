const todo = {
  id: {
    type: 'string',
    errorMessage: {
      _: 'wrong data in field id'
    }
  },
  title: {
    type: 'string',
    errorMessage: {
      _: 'wrong data in field title'
    }
  },
  description: {
    type: 'string',
    errorMessage: {
      _: 'wrong data in field description'
    }
  },
  completed: {
    type: 'boolean',
    errorMessage: {
      _: 'wrong data in field completed'
    }
  },

}

export default todo
