
class Response {
  // using with SUCCESS
  static PAGEABLE(listData = [], totalElement, currentPage = 1, size = 20) {
    return {
      items: listData,
      pageable: {
        totalElement: totalElement,
        currentElement: listData ? listData.length : 0,
        totalPage: Math.ceil(totalElement / size),
        page: currentPage,
        size: size,
        // hasNext: totalElement - ((currentPage - 1) * size + (listData ? listData.length : 0)) > 0
        hasNext: totalElement - currentPage * size > 0
      }
    }
  }

  static SUCCESS(message = '', data = null) {
    return {
      code: 200,
      data: {
        result: true,
        message,
        data
      }
    }
  }

  static ERROR(code = 500, message = '', errorCode = null, data = null) {
    return {
      code,
      data: {
        result: false,
        message,
        data,
        errorCode: errorCode
      }
    }
  }

  static WARN(code = 400, message = '', errorCode = null, data = null) {
    return {
      code,
      data: {
        result: false,
        message,
        data,
        errorCode: errorCode
      }
    }
  }
  //using for response internal server
  static LOCAL_SUCCESS(data, message = "Ok!") {
    return {
      result: true,
      message,
      data
    }
  }

  static LOCAL_ERROR(errorCode, message, data) {
    return {
      result: false,
      message,
      errorCode: errorCode,
      data
    }
  }

  static RESPONSE_REDIRECT(url, httpStatus = 301) {
    return {
      url,
      httpStatus
    }
  }

  static SOCKET_RESPONSE_SUCCESS(roomName, data = null) {
    return {
      result: true,
      roomName,
      dataResp: data
    }
  }
  static SOCKET_RESPONSE_ERROR(errorCode, data = null, roomName) {
    return {
      result: false,
      roomName,
      errorCode,
      dataResp: data
    }
  }

}

export default Response
