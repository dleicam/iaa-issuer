import os

DEBUG=True

for root, dirs, files in os.walk("."):
    for file in files:
        filename = os.path.join(root, file)
        print(filename)
        print(filename + ".txt") 
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                data = f.read()
                print(filename.endswith(".txt"))
                if DEBUG: 
                    if filename.endswith(".txt") and os.path.exists(filename):
                        os.remove(filename)
                else:
                    with open(os.path.join(".", file + ".txt"), 'w') as f_new:
                        f_new.write(data)
