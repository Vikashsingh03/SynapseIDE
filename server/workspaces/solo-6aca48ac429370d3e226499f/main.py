
def is_even(n):
    return n % 2 == 0

try:
    num = int(input("Enter an integer: "))
    
    if is_even(num):
        print("{} is even.".format(num))
    else:
        print("{} is odd.".format(num))

except ValueError:
    print("Invalid input. Please enter a valid integer.")
