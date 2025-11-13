from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponseRedirect
def generate_successful_response(data, status:int = status.HTTP_200_OK):
    # default status code = 200 represents success
    return Response({"message": data}, status = status)

def generate_error_response(message, status:int = status.HTTP_500_INTERNAL_SERVER_ERROR):
    # default status code = 500 represents server error or unknown error
    #if there is no server error or unknown error, pass status_code that is valid for such error
    print("Error occurred: ", message)
    return Response({"message": message}, status = status)

def redirect(redirect_to: str ='/'):
    return HttpResponseRedirect(redirect_to)


