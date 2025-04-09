(let [x 4
      y (fn [] x)]
  (let [x 3]
    (print (y))))