const validate = (ajvValidate) => {
  return (req, res, next) => {
    const data = req.method =="GET" ? req.query : req.body;
    const valid = ajvValidate(data)
    if (!valid) {
      const errors = ajvValidate.errors
      const payload = []
      let message = `VALIDATION ERROR\n`
      errors.forEach(error => {
        message += `Error: ${error?.message}\n`
        console.log(error);
        payload.push({
          dataPath: error.instancePath,
          error: error.message
        })
      })
      return res.status(400).json({ message, errorCode: "invalid_data", payload,  })
    }
    next()
  }
}

export default validate
